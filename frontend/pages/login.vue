<script setup lang="ts">
import { asApiError } from '~/composables/useApi'
import { isSafeRedirectPath } from '~/utils/safeRedirect'

definePageMeta({ layout: false })

const { login } = useAuth()
const route = useRoute()

useHead({ title: 'Log in — ClinicCare' })

const email = ref('')
const password = ref('')
const submitting = ref(false)
const showErrors = ref(false)
const serverError = ref<string | null>(null)

const emailError = computed(() => (email.value.trim() ? null : 'Email is required.'))
const passwordError = computed(() => (password.value ? null : 'Password is required.'))
const isValid = computed(() => !emailError.value && !passwordError.value)

const redirectTarget = computed(() => {
  const raw = route.query.redirect
  return typeof raw === 'string' && isSafeRedirectPath(raw) ? raw : '/consultations'
})

async function onSubmit(): Promise<void> {
  showErrors.value = true
  if (!isValid.value || submitting.value) return

  serverError.value = null
  submitting.value = true
  try {
    await login(email.value.trim(), password.value)
    await navigateTo(redirectTarget.value)
  }
  catch (cause) {
    serverError.value = asApiError(cause).message
    submitting.value = false
  }
}
</script>

<template>
  <section class="login">
    <h1>ClinicCare</h1>

    <form novalidate @submit.prevent="onSubmit">
      <p v-if="serverError" role="alert" class="form-error">
        {{ serverError }}
      </p>

      <div class="field">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="username"
          :aria-invalid="showErrors && emailError ? true : undefined"
          :aria-describedby="showErrors && emailError ? 'email-error' : undefined"
        >
        <p v-if="showErrors && emailError" id="email-error" class="field-error">
          {{ emailError }}
        </p>
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          :aria-invalid="showErrors && passwordError ? true : undefined"
          :aria-describedby="showErrors && passwordError ? 'password-error' : undefined"
        >
        <p v-if="showErrors && passwordError" id="password-error" class="field-error">
          {{ passwordError }}
        </p>
      </div>

      <button type="submit" class="primary" :disabled="submitting">
        {{ submitting ? 'Logging in…' : 'Log in' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: system-ui, sans-serif;
  background: #fff;
  color: #1a1a1a;
}

h1 {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 22rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
}

input {
  padding: 0.5rem 0.625rem;
  border: 1px solid #b9c2cb;
  border-radius: 6px;
  font: inherit;
}

input[aria-invalid='true'] {
  border-color: #b23c3c;
}

.field-error {
  margin: 0;
  color: #8a2020;
  font-size: 0.875rem;
}

.form-error {
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid #d8a7a7;
  border-radius: 6px;
  background: #fdf3f3;
  color: #8a2020;
}

.primary {
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 6px;
  background: #1f4d7a;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.primary:hover:not(:disabled),
.primary:focus-visible {
  background: #163a5c;
}

.primary:disabled {
  background: #8b9cad;
  cursor: progress;
}
</style>
