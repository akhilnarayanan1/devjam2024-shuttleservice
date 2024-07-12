// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', 'nuxt-vuefire'],
  css: ['~/assets/css/material-icons.css'],
  // hiding config until we setup DB security 🔒
  vuefire: {
    auth: {
      enabled: true
    },
    config: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    },
  },
  runtimeConfig: {
    WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN,
    GRAPH_API_VERSION: process.env.GRAPH_API_VERSION,
    GRAPH_API_TOKEN: process.env.GRAPH_API_TOKEN,
    BUSINESS_WA_NO: process.env.BUSINESS_WA_NO,
    ONE_DRIVER: process.env.ONE_DRIVER,
  },
  nitro: {
    firebase: {
      gen: 2
    }
  }
})