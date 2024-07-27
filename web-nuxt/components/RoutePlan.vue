<template>
     <div class="flex justify-center mx-4">
            <div class="card shadow max-w-sm m-4">
                <div class="flex justify-center items-center mt-4">
                    <div class="card-title">Route Planner</div>
                </div>
                <div class="card-body">
                    <form id="formTripPlanner" @submit.prevent="startTrip">
                        <div class="label"><span class="label-text-alt">Shuttle:</span></div>
                        <select v-model="route" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a shuttle</option>
                            <option v-for="shuttle in _.orderBy(shuttles, ['type', 'orderid'], ['desc', 'asc'])" :key="shuttle.time" :value="shuttle">
                                {{ shuttle.type }} - {{ shuttle.time }} - {{ shuttle.number }} 
                            </option>
                        </select>
                        
                        <div class="label"><span class="label-text-alt">From:</span></div>
                        <select v-model="from" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a location</option>
                            <option v-for="location in locations" :key="location.id" :value="location">{{ location.place.shortname }}</option>
                        </select>

                        <div class="flex justify-center items-center mt-4">
                            <button type="button" class="btn btn-ghost btn-sm" @click="swapLocations">
                                <span class="material-symbols-outlined">swap_vert</span>
                                <span>SWAP</span>
                                <span class="material-symbols-outlined">swap_vert</span>
                            </button>
                        </div>

                        <div class="label"><span class="label-text-alt">To:</span></div>
                        <select v-model="to" class="select select-bordered w-full max-w-xs">
                            <option disabled selected>Pick a location</option>
                            <option v-for="location in locations" :key="location.id" :value="location">{{ location.place.shortname }}</option>
                        </select>

                        <button type="submit" class="btn btn-block glass bg-primary hover:bg-primary text-white mt-4">
                            <span v-if="loading.form_route_plan" class="loading loading-spinner loading-sm"></span>
                            <span>START TRIP</span>
                        </button>
                    </form>
                </div>
            </div> 
        </div>
</template>


<script setup lang="ts">
    import { collection, query, getDocs, addDoc } from "firebase/firestore";
    import type { ToastData, WhatsAppCTAMessage, Location, LocationStore, Shuttle, Route } from "~/assets/js/types";
    import _ from "lodash";

    const loading = reactive({ form_route_plan: false });
    const db = useFirestore();

    
    const shuttles = reactive<Array<Shuttle>>([]);
    const route = ref<Shuttle>({} as Shuttle);

    const locations = reactive<Array<LocationStore>>([]);
    const from = ref<LocationStore>({} as LocationStore);
    const to = ref<LocationStore>({} as LocationStore);

    const querySnapshotLocations = await getDocs(query(collection(db, "locations")));
    querySnapshotLocations.forEach((doc) => {  
        locations.push({id: doc.id, place: {...doc.data()} as Location});
    });

    const querySnapshotShuttles = await getDocs(query(collection(db, "shuttles")));
    querySnapshotShuttles.forEach((doc) => {  
        shuttles.push({...doc.data()} as Shuttle);
    });

    watch(route, (newVal) => {
        if (newVal.type === "pick") {
            from.value = locations.find(location => location.place.routekey === "metro") as LocationStore;
            to.value = locations.find(location => location.place.routekey === "office") as LocationStore;
        } else {
            from.value = locations.find(location => location.place.routekey === "office") as LocationStore;
            to.value = locations.find(location => location.place.routekey === "metro") as LocationStore;
        }
    });
    

    const startTrip = async () => {
        if (from.value.id === to.value.id) {
            addToast({
                message: "From and To locations cannot be the same",
                type: "error",
                duration: 3000,
            })
            return;
        }
        if (!from.value || !to.value) {
            addToast({
                message: "Please select both From and To locations",
                type: "error",
                duration: 3000,
            })
            return;
        }

        loading.form_route_plan = true;

        await addDoc(collection(db, "routes"), {
            from: from.value,
            to: to.value,
        } as Route);

        const { data: waResponse, status, error } = await useFetch<WhatsAppCTAMessage>(`/api/send-message-to-driver`, {
            method: "POST",
            body: {
                origin:  from.value.place.placename,
                originPlaceId: from.value.place.placeid,
                destination: to.value.place.placename,
                destinationPlaceId: to.value.place.placeid,
                originShortName: from.value.place.shortname,
                destinationShortName: to.value.place.shortname,
                travelmode: "driving",
            },
        });

        loading.form_route_plan = false;

        if (error.value) {
            addToast({
                message: JSON.stringify(error.value?.message),
                type: "error",
                duration: 3000,
            } as ToastData)
            return;
        }

        addToast({
            message: JSON.stringify(waResponse.value),
            type: "success",
            duration: 3000,
        } as ToastData)
        
        
    };
    
    // swap values inside from and to
    const swapLocations = () => [from.value, to.value] = [to.value, from.value];
</script>