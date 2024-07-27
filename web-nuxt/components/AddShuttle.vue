<template>
    <div>
        <div class="flex justify-center mx-4">
            <div class="card shadow max-w-sm m-4">
                <div class="flex justify-center items-center mt-4">
                    <div class="card-title">Add Shuttle</div>
                </div>
                <div class="card-body">
                    <form id="formAddShuttle" @submit.prevent="addShuttle">
                        
                        <div class="form-control">
                            <div class="relative input-group border rounded-lg">
                                <input autocomplete="false" v-model="form.shuttle_number" type="text" placeholder="Enter shuttle number" class="w-full input"> 
                            </div>
                            <InputLabel labelName="shuttle_number"/>
                        </div>

                        <select v-model="form.shuttle_type_time"  class="select select-bordered w-full max-w-xs mt-4">
                            <option disabled selected>Pick shuttle time</option>
                            <option :value="{orderid: 1, type: 'pick', time: '08:30 AM'}">Pick - 08:30 AM</option>
                            <option :value="{orderid: 2, type: 'pick', time: '08:50 AM'}">Pick - 08:50 AM</option>
                            <option :value="{orderid: 3, type: 'pick', time: '09:10 AM'}">Pick - 09:10 AM</option>
                            <option :value="{orderid: 4, type: 'pick', time: '09:30 AM'}">Pick - 09:30 AM</option>
                            <option :value="{orderid: 5, type: 'pick', time: '09:50 AM'}">Pick - 09:50 AM</option>
                            <option :value="{orderid: 6, type: 'pick', time: '10:15 AM'}">Pick - 10:15 AM</option>
                            <option :value="{orderid: 7, type: 'pick', time: '10:45 AM'}">Pick - 10:45 AM</option>
                            <option :value="{orderid: 8, type: 'pick', time: '11:15 AM'}">Pick - 11:15 AM</option>
                            <option :value="{orderid: 1, type: 'drop', time: '04:30 PM'}">Drop - 04:30 PM</option>
                            <option :value="{orderid: 2, type: 'drop', time: '04:50 PM'}">Drop - 04:50 PM</option>
                            <option :value="{orderid: 3, type: 'drop', time: '05:10 PM'}">Drop - 05:10 PM</option>
                            <option :value="{orderid: 4, type: 'drop', time: '05:30 PM'}">Drop - 05:30 PM</option>
                            <option :value="{orderid: 5, type: 'drop', time: '05:50 PM'}">Drop - 05:50 PM</option>
                            <option :value="{orderid: 6, type: 'drop', time: '06:10 PM'}">Drop - 06:10 PM</option>
                            <option :value="{orderid: 7, type: 'drop', time: '06:30 PM'}">Drop - 06:30 PM</option>
                            <option :value="{orderid: 8, type: 'drop', time: '07:00 PM'}">Drop - 07:00 PM</option>
                            <option :value="{orderid: 9, type: 'drop', time: '07:30 PM'}">Drop - 07:30 PM</option>
                        </select>

                        <button type="submit" class="btn btn-block glass bg-primary hover:bg-primary text-white mt-4">
                            <span v-if="loading.form_add_shuttle" class="loading loading-spinner loading-sm"></span>
                            <span>ADD SHUTTLE</span>
                        </button>

                    </form>
                </div>
            </div> 
        </div>
    </div>
</template>

<script setup lang="ts">

import { collection, query, getDocs, addDoc } from "firebase/firestore";
import type { ToastData, Shuttle, ShuttleDetails } from "~/assets/js/types";

const loading = reactive({ form_add_shuttle: false });
const db = useFirestore();

//Create a form
const form = reactive({
    shuttle_number: '',
    shuttle_type_time: {} as ShuttleDetails
});

const addShuttle = async () => {
    await addDoc(collection(db, "shuttles"),  {
        ...form.shuttle_type_time, 
        number: form.shuttle_number
    } as ShuttleDetails);

    addToast({
        message: "Shuttle Added!",
        type: "success",
        duration: 3000,
    } as ToastData);
};
    
</script>