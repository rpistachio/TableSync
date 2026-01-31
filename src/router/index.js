import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import MenuView from '../views/MenuView.vue';
import StepsView from '../views/StepsView.vue';
import ShoppingListView from '../views/ShoppingListView.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView
  },
  {
    path: '/menu',
    name: 'Menu',
    component: MenuView
  },
  {
    path: '/steps',
    name: 'Steps',
    component: StepsView
  },
  {
    path: '/shopping-list',
    name: 'ShoppingList',
    component: ShoppingListView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;

