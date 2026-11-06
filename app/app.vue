<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <ClientOnly>
      <VitePwaManifest />
    </ClientOnly>
    <NuxtPage />
  </div>
</template>

<style>
@import '~/assets/css/main.css';
</style>
