<script setup lang="ts"></script>

<template>
  <div class="layout">
    <header class="masthead">
      <NuxtLink to="/" class="brand">
        ClinicCare
      </NuxtLink>
      <nav aria-label="Main">
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

.content {
  padding: 1.5rem;
}
</style>
