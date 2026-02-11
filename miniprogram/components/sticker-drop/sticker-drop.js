Component({
  properties: {
    visible: { type: Boolean, value: false },
    stickerName: { type: String, value: '' },
    stickerId: { type: String, value: '' }
  },
  data: {
    animating: false
  },
  methods: {
    onCardTap: function () {},
    onClose: function () {
      this.triggerEvent('close');
    }
  }
});
