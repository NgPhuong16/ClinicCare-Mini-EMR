<script setup lang="ts">
const { doctor, isLoggedIn, logout } = useAuth()
</script>

<template>
  <div class="layout">
    <header class="masthead">
      <NuxtLink to="/" class="brand">
        ClinicCare
      </NuxtLink>
      <nav v-if="isLoggedIn" aria-label="Main">
        <NuxtLink to="/consultations">
          Consultations
        </NuxtLink>
        <NuxtLink to="/consultations/new">
          New consultation
        </NuxtLink>
        <NuxtLink to="/search">
          Search
        </NuxtLink>
      </nav>
      <div v-if="isLoggedIn" class="account">
        <span class="email">{{ doctor?.email }}</span>
        <button type="button" class="link-button" @click="logout">
          Log out
        </button>
      </div>
    </header>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  font-family: system-ui, sans-serif;
  /* The palette assumes a light surface. Without an explicit background the browser's
     dark-mode default shows through and the dark text becomes unreadable. */
  background: #fff;
  color: #1a1a1a;
}

.masthead {
  display: flex;
  align-items: baseline;
  gap: 2rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e2e2;
}

.brand {
  font-weight: 700;
  font-size: 1.125rem;
  text-decoration: none;
  color: inherit;
}

nav {
  display: flex;
  gap: 1.25rem;
}

nav a {
  color: #30506b;
  text-decoration: none;
}

nav a:hover,
nav a:focus-visible {
  text-decoration: underline;
}

nav a.router-link-active {
  font-weight: 600;
  color: #1a1a1a;
}

.account {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.email {
  color: #5a5a5a;
  font-size: 0.875rem;
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: #30506b;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.content {
  padding: 1.5rem;
}
</style>
