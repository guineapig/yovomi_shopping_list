<script setup lang="ts">
const { session, restored, restore } = useSession()
const { login, verifyTwoFactor, cancelTwoFactor, pending, error, loading } = useYuvomiAuth()

const serverUrl = ref('')
const username = ref('')
const password = ref('')
const code = ref('')

onMounted(() => {
  restore()
  const saved = localStorage.getItem('yuvomi-shopping:last-server-url')
  if (saved) serverUrl.value = saved
  if (session.value) navigateTo('/')
})

watch(session, (s) => {
  if (s) navigateTo('/')
})

async function onSubmit() {
  const result = await login(serverUrl.value, username.value, password.value).catch(() => null)
  if (result && !result.twoFactorRequired) {
    localStorage.setItem('yuvomi-shopping:last-server-url', serverUrl.value)
  }
}

async function onVerify() {
  await verifyTwoFactor(code.value).catch(() => null)
  localStorage.setItem('yuvomi-shopping:last-server-url', serverUrl.value)
}
</script>

<template>
  <div class="screen" style="justify-content: center;">
    <div style="text-align: center; margin-bottom: 28px;">
      <img src="/icon-192.png" alt="" width="64" height="64" style="border-radius: 16px;" />
      <h1 style="margin: 12px 0 4px; font-size: 1.4rem;">Einkaufsliste</h1>
      <p style="color: var(--text-muted); margin: 0;">Verbinde dich mit deiner eigenen Yuvomi-Instanz.</p>
    </div>

    <div class="card">
      <div v-if="error" class="alert">{{ error }}</div>

      <form v-if="!pending" @submit.prevent="onSubmit">
        <div class="field">
          <label for="serverUrl">Server-Adresse</label>
          <input
            id="serverUrl"
            v-model="serverUrl"
            type="url"
            inputmode="url"
            placeholder="https://yuvomi.meine-domain.de"
            autocomplete="url"
            required
          />
        </div>
        <div class="field">
          <label for="username">Benutzername</label>
          <input id="username" v-model="username" type="text" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="password">Passwort</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn" type="submit" :disabled="loading" style="width: 100%;">
          {{ loading ? 'Melde an …' : 'Anmelden' }}
        </button>
      </form>

      <form v-else @submit.prevent="onVerify">
        <p style="margin-top: 0;">Gib den Code deiner Authenticator-App ein.</p>
        <div class="field">
          <label for="code">Code</label>
          <input id="code" v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" autofocus required />
        </div>
        <button class="btn" type="submit" :disabled="loading" style="width: 100%; margin-bottom: 8px;">
          {{ loading ? 'Prüfe …' : 'Bestätigen' }}
        </button>
        <button class="btn ghost" type="button" style="width: 100%;" @click="cancelTwoFactor">Abbrechen</button>
      </form>
    </div>

    <p style="text-align: center; color: var(--text-muted); font-size: 0.82rem; margin-top: 20px;">
      Die Anmeldedaten werden ausschließlich an deinen eigenen Server gesendet und nur in diesem Browser gespeichert.
    </p>
  </div>
</template>
