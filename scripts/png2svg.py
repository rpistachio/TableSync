#!/usr/bin/env python3
"""
批量将 PNG 图片转换为 SVG

用法:
  python3 scripts/png2svg.py <输入目录> [输出目录] [选项]

示例:
  # 将 images/ 下所有 PNG 转为 SVG（默认嵌入模式）
  python3 scripts/png2svg.py images/

  # 指定输出目录
  python3 scripts/png2svg.py images/ output_svgs/

  # 使用嵌入模式（将 PNG base64 嵌入 SVG，保留完整色彩和细节）
  python3 scripts/png2svg.py images/ --mode embed

  # 使用追踪模式（需要系统安装 potrace: brew install potrace）
  python3 scripts/png2svg.py images/ --mode trace

  # 追踪模式 - 彩色分层（按颜色量化后逐层追踪）
  python3 scripts/png2svg.py images/ --mode trace --color color --colors 8

  # 递归处理子目录
  python3 scripts/png2svg.py images/ -r

依赖:
  pip3 install --user Pillow

  追踪模式额外需要:
  brew install potrace
"""

import argparse
import base64
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("错误：请先安装 Pillow: pip3 install --user Pillow")
    sys.exit(1)


def png_to_svg_embed(png_path: str, svg_path: str):
    """
    嵌入模式：将 PNG 以 base64 编码嵌入 SVG 中。
    优点：保留完整色彩和细节，无需额外依赖。
    缺点：文件体积较大，不是真正的矢量图。
    """
    img = Image.open(png_path)
    width, height = img.size

    with open(png_path, "rb") as f:
        png_data = base64.b64encode(f.read()).decode("utf-8")

    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{width}" height="{height}"
     viewBox="0 0 {width} {height}">
  <image width="{width}" height="{height}"
         href="data:image/png;base64,{png_data}"/>
</svg>
'''
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)


def _check_potrace():
    """检查系统是否安装了 potrace 命令行工具"""
    return shutil.which("potrace") is not None


def _trace_bmp_to_svg(bmp_path: str, svg_path: str, color: str = "black",
                      turd_size: int = 2, alpha_max: float = 1.0,
                      opttolerance: float = 0.2):
    """调用系统 potrace 将 BMP 转为 SVG"""
    cmd = [
        "potrace",
        bmp_path,
        "-s",  # SVG 输出
        "-o", svg_path,
        "--color", color,
        "--turdsize", str(turd_size),
        "--alphamax", str(alpha_max),
        "--opttolerance", str(opttolerance),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"potrace 失败: {result.stderr}")


def png_to_svg_trace_bw(png_path: str, svg_path: str, threshold: int = 128):
    """
    黑白追踪模式：PNG -> 灰度 -> 二值BMP -> potrace -> SVG
    适合图标、线条画、简单图形。
    """
    img = Image.open(png_path).convert("L")
    # 二值化
    bw = img.point(lambda x: 255 if x > threshold else 0, mode="1")

    with tempfile.NamedTemporaryFile(suffix=".bmp", delete=False) as tmp:
        tmp_bmp = tmp.name
        bw.save(tmp_bmp)

    try:
        _trace_bmp_to_svg(tmp_bmp, svg_path)
    finally:
        os.unlink(tmp_bmp)


def png_to_svg_trace_color(png_path: str, svg_path: str, num_colors: int = 8,
                           threshold: int = 128):
    """
    彩色追踪模式：
    1. 量化颜色（减少颜色数量）
    2. 对每种颜色创建蒙版
    3. 对每个蒙版调用 potrace 追踪
    4. 合并所有路径到一个 SVG
    """
    img = Image.open(png_path).convert("RGBA")
    width, height = img.size

    # 量化颜色
    # 先转 RGB 量化，再处理透明度
    rgb = img.convert("RGB")
    quantized = rgb.quantize(colors=num_colors, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()  # [R, G, B, R, G, B, ...]

    # 获取量化后的像素索引
    pixels = list(quantized.getdata())
    alpha_pixels = list(img.getdata())  # 原始 RGBA

    # 收集每种颜色的信息
    color_masks = {}
    for i, (idx, (_, _, _, a)) in enumerate(zip(pixels, alpha_pixels)):
        if a < 128:  # 跳过几乎透明的像素
            continue
        r = palette[idx * 3]
        g = palette[idx * 3 + 1]
        b = palette[idx * 3 + 2]
        color_key = (r, g, b)
        if color_key not in color_masks:
            color_masks[color_key] = Image.new("1", (width, height), 0)
        x = i % width
        y = i // width
        color_masks[color_key].putpixel((x, y), 1)

    # 对每种颜色追踪
    svg_layers = []
    tmpdir = tempfile.mkdtemp()

    try:
        for color_key, mask in color_masks.items():
            r, g, b = color_key
            hex_color = f"#{r:02x}{g:02x}{b:02x}"

            # 保存蒙版为 BMP（potrace 需要反转：黑色=前景）
            # potrace 追踪黑色区域，所以需要反转
            inverted = mask.point(lambda x: 0 if x else 255, mode="1")
            bmp_path = os.path.join(tmpdir, f"mask_{r}_{g}_{b}.bmp")
            svg_layer_path = os.path.join(tmpdir, f"layer_{r}_{g}_{b}.svg")

            # potrace 需要的是 PBM 格式更好
            pbm_path = os.path.join(tmpdir, f"mask_{r}_{g}_{b}.pbm")
            mask.save(pbm_path)

            try:
                _trace_bmp_to_svg(pbm_path, svg_layer_path, color=hex_color)
                # 读取生成的 SVG，提取 path 元素
                with open(svg_layer_path, "r") as f:
                    content = f.read()
                # 提取 <path> 标签
                import re
                paths = re.findall(r'<path[^/]*/>', content, re.DOTALL)
                paths += re.findall(r'<path[^>]*>.*?</path>', content, re.DOTALL)
                for p in paths:
                    # 确保颜色正确
                    if 'fill="' not in p:
                        p = p.replace("<path", f'<path fill="{hex_color}"', 1)
                    svg_layers.append(p)
            except Exception as e:
                print(f"    警告：颜色 {hex_color} 追踪失败: {e}")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    # 组合所有层
    layers_str = "\n  ".join(svg_layers)
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="{width}" height="{height}"
     viewBox="0 0 {width} {height}">
  {layers_str}
</svg>
'''
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)


def convert_directory(input_dir: str, output_dir: str, mode: str,
                      recursive: bool, color_mode: str, num_colors: int,
                      threshold: int):
    """批量转换目录中的 PNG 文件"""
    input_path = Path(input_dir).resolve()
    output_path = Path(output_dir).resolve() if output_dir else input_path

    if not input_path.exists():
        print(f"错误：输入目录不存在: {input_dir}")
        sys.exit(1)

    # 检查追踪模式依赖
    if mode == "trace" and not _check_potrace():
        print("错误：追踪模式需要安装 potrace 命令行工具")
        print("  macOS:   brew install potrace")
        print("  Ubuntu:  sudo apt-get install potrace")
        print("  或使用嵌入模式: --mode embed")
        sys.exit(1)

    # 查找所有 PNG 文件
    if recursive:
        png_files = list(input_path.rglob("*.png")) + list(input_path.rglob("*.PNG"))
    else:
        png_files = list(input_path.glob("*.png")) + list(input_path.glob("*.PNG"))

    # 去重（大小写不敏感的文件系统可能重复）
    seen = set()
    unique_files = []
    for f in png_files:
        key = str(f).lower()
        if key not in seen:
            seen.add(key)
            unique_files.append(f)
    png_files = sorted(unique_files)

    if not png_files:
        print(f"未找到 PNG 文件: {input_dir}")
        return

    mode_desc = {
        "embed": "嵌入模式（base64 嵌入）",
        "trace": f"追踪模式（{'黑白' if color_mode == 'bw' else '彩色 ' + str(num_colors) + ' 色'}）",
    }

    print(f"┌─────────────────────────────────────────────")
    print(f"│ PNG → SVG 批量转换")
    print(f"│ 找到 {len(png_files)} 个 PNG 文件")
    print(f"│ 模式: {mode_desc.get(mode, mode)}")
    print(f"│ 输入: {input_path}")
    print(f"│ 输出: {output_path}")
    print(f"└─────────────────────────────────────────────")
    print()

    success_count = 0
    fail_count = 0

    for i, png_file in enumerate(png_files, 1):
        # 计算输出路径，保持目录结构
        relative = png_file.relative_to(input_path)
        svg_file = output_path / relative.with_suffix(".svg")

        # 确保输出目录存在
        svg_file.parent.mkdir(parents=True, exist_ok=True)

        try:
            if mode == "embed":
                png_to_svg_embed(str(png_file), str(svg_file))
            elif mode == "trace":
                if color_mode == "bw":
                    png_to_svg_trace_bw(str(png_file), str(svg_file),
                                        threshold=threshold)
                else:
                    png_to_svg_trace_color(str(png_file), str(svg_file),
                                           num_colors=num_colors,
                                           threshold=threshold)

            # 计算文件大小
            png_size = png_file.stat().st_size
            svg_size = svg_file.stat().st_size
            ratio = svg_size / png_size if png_size > 0 else 0

            print(f"  [{i}/{len(png_files)}] ✓ {relative}")
            print(f"           PNG: {_format_size(png_size)} → SVG: {_format_size(svg_size)} ({ratio:.1f}x)")
            success_count += 1
        except Exception as e:
            print(f"  [{i}/{len(png_files)}] ✗ {relative} - {e}")
            fail_count += 1

    print()
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  完成！成功: {success_count}  失败: {fail_count}")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


def _format_size(size_bytes: int) -> str:
    """格式化文件大小"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def main():
    parser = argparse.ArgumentParser(
        description="批量将 PNG 图片转换为 SVG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s images/                              # 转换（默认嵌入模式）
  %(prog)s images/ output/                      # 指定输出目录
  %(prog)s images/ --mode embed                 # 嵌入模式
  %(prog)s images/ --mode trace                 # 追踪模式（需要 potrace）
  %(prog)s images/ --mode trace --color bw      # 黑白追踪
  %(prog)s images/ --mode trace --colors 16     # 彩色追踪 16 色
  %(prog)s images/ -r                           # 递归处理子目录
        """
    )

    parser.add_argument("input_dir", help="输入目录路径（包含 PNG 文件）")
    parser.add_argument("output_dir", nargs="?", default=None,
                        help="输出目录路径（默认与输入目录相同）")
    parser.add_argument("--mode", "-m", choices=["trace", "embed"],
                        default="embed",
                        help="转换模式: embed=base64嵌入(默认), trace=矢量追踪(需要potrace)")
    parser.add_argument("--color", "-c", choices=["bw", "color"],
                        default="color",
                        help="追踪模式的颜色: bw=黑白, color=彩色(默认)")
    parser.add_argument("--colors", "-n", type=int, default=8,
                        help="彩色追踪的颜色数量（默认: 8）")
    parser.add_argument("--threshold", "-t", type=int, default=128,
                        help="黑白模式的二值化阈值 0-255（默认: 128）")
    parser.add_argument("--recursive", "-r", action="store_true",
                        help="递归处理子目录")

    args = parser.parse_args()

    convert_directory(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        mode=args.mode,
        recursive=args.recursive,
        color_mode=args.color,
        num_colors=args.colors,
        threshold=args.threshold,
    )


if __name__ == "__main__":
    main()
