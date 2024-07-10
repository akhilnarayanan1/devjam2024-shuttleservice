<template>
    <div>
        {{data}}
        {{ status }}
        {{ error }}
        <!-- {{ refresh }} -->
    </div>
</template>

<script setup lang="ts">

const route = useRoute();
const query = route.query;

const { data, status, error, refresh } = await useFetch(`/api/webhook`, {query: query});

</script>

