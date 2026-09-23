<script setup lang="ts">
const { consultations, pending, error } = useConsultationList()

useHead({ title: 'Consultations — ClinicCare' })
</script>

<template>
  <section>
    <header class="head">
      <h1>Consultations</h1>
      <NuxtLink to="/consultations/new" class="primary-link">
        New consultation
      </NuxtLink>
    </header>

    <p v-if="pending" role="status">
      Loading consultations…
    </p>

    <p v-else-if="error" role="alert" class="error">
      {{ error.message }}
    </p>

    <p v-else-if="consultations.length === 0" class="empty">
      No consultations yet. <NuxtLink to="/consultations/new">
        Record the first one
      </NuxtLink>.
    </p>

    <ConsultationTable v-else :consultations="consultations" />
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
}

.primary-link {
  padding: 0.5rem 0.875rem;
  background: #1f4d7a;
  border-radius: 6px;
  color: #fff;
  text-decoration: none;
}

.primary-link:hover,
.primary-link:focus-visible {
  background: #163a5c;
}

.error {
  padding: 0.75rem 1rem;
  border: 1px solid #d8a7a7;
  border-radius: 6px;
  background: #fdf3f3;
  color: #8a2020;
}

.empty {
  color: #5a5a5a;
}
</style>
