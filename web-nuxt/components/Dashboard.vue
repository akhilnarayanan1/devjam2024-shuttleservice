<template>
    <Navbar />
    <div v-if="!profile.sesaid">
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
                <span class="text-base-100">{{ profile.sesaid }}</span>
            </div>
        </div>

        <div class="flex justify-center mx-4">
            <div class="card shadow max-w-sm m-4">
                <div class="card-body">
                    <form id="formTripPlanner" @submit.prevent="startTrip">
                        <div class="label"><span class="label-text-alt">From:</span></div>
                        <select v-model="from" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a location</option>
                            <option v-for="location in locations" :key="location.id" :value="location">{{ Object.keys(location.place)[0] }}</option>
                        </select>

                        <div class="flex justify-center items-center mt-4">
                            <button class="btn btn-ghost btn-sm" @click="swapLocations">
                                <span class="material-symbols-outlined">swap_vert</span>
                                SWAP
                                <span class="material-symbols-outlined">swap_vert</span>
                            </button>
                        </div>

                        <div class="label"><span class="label-text-alt">To:</span></div>
                        <select v-model="to" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a location</option>
                            <option v-for="location in locations" :key="location.id" :value="location">{{ Object.keys(location.place)[0] }}</option>
                        </select>

                        <button type="submit" class="btn btn-block glass bg-primary hover:bg-primary text-white mt-4">
                            <span v-if="false" class="loading loading-spinner loading-sm"></span>
                            <span>START TRIP</span>
                        </button>
                    </form>
                    <a :href="routeMapUrl" target="_blank" class="btn btn-circle btn-primary">Visit Map</a>
                </div>
            </div> 
        </div>

    </div>
</template>

<script setup lang="ts">
    import { collection, query, getDocs } from "firebase/firestore";
    import type { ToastData, WhatsAppCTAMessage } from "~/assets/js/types";

    const profile = getProfile();
    const db = useFirestore();

    interface Location {
        id: string;
        place: { [key: string]: string };
    }

    const from = ref({} as Location);
    const to = ref<Location>({} as Location);
    const locations = reactive<Array<Location>>([]);

    const routeMapUrl = ref<string>("");

    const q = query(collection(db, "locations"));

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {  
        locations.push({
            id: doc.id,
            place: doc.data()
        });
    });

    const startTrip = async () => {
        if (from.value === to.value) {
            addToast({
                message: "From and To locations cannot be the same",
                type: "error",
                duration: 3000,
            })
            return;
        }

        const { data: waResponse, status, error } = await useFetch<WhatsAppCTAMessage>(`/api/sendMessagetoDriver`, {
            query: {
                origin: Object.keys(from.value.place)[0],
                origin_place_id: Object.values(from.value.place)[0],
                destination: Object.keys(to.value.place)[0],
                destination_place_id: Object.values(to.value.place)[0],
                travelmode: "driving"
            }
        });

        if (status.value != "success") {
            addToast({
                message: JSON.stringify(error.value),
                type: "error",
            } as ToastData)
            return;
        }

        addToast({
            message: JSON.stringify(waResponse.value),
            type: "success",
        } as ToastData)
        
        
    };

    // swap values inside from and to
    const swapLocations = () => {
        [from.value, to.value] = [to.value, from.value];
    };
</script>