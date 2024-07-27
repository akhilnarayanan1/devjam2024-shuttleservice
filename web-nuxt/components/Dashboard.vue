<template>
    <div v-if="!profile.name">
        <div class="flex justify-center mx-4">
            <div class="skelton h-16 max-w-96 ">
                <span class="text-base-100">a</span>
            </div>
            <div class="skeleton w-96"></div>
        </div>
    </div>
    <div v-else>
        <div class="flex justify-center mx-4">
            <div class="alert bg-emerald-600 max-w-96 shadow-lg flex justify-between">
                <span class="text-base-100">{{ profile.name }}</span>
            </div>
        </div>
        
        <RoutePlan />

        <!-- <AddShuttle /> -->
       
    </div>
</template>

<script setup lang="ts">
    const profile = getProfile();

</script>