<template>

    <dialog id="completeProfileModal" :class="completeProfileModal.open ? 'modal modal-open' : 'modal' ">
        <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Complete Profile</h3>

            <form id="formCreateAccount" @submit.prevent="createAccount">
                <div class="form-control">
                    <div class="relative input-group border rounded-lg">
                        <div class="absolute mt-3 flex items-center ps-3.5">
                            <span class="material-symbols-outlined">signature</span>
                        </div>
                        <input id="inputName" v-model="form.update_name" type="text" placeholder="Enter your name" class="w-full input ps-12">
                    </div>
                    <InputLabel labelName="update_name"/>
                </div>

                <div class="form-control">
                    <div class="relative input-group border rounded-lg">
                        <div class="absolute mt-3 flex items-center ps-3.5">
                            <span class="material-symbols-outlined">id_card</span>
                        </div>
                        <input id="inputSesaId" v-model="form.update_sesaid" type="text" placeholder="Enter your SESAID" class="w-full input ps-12"> 
                    </div>
                    <InputLabel labelName="update_sesaid"/>
                </div>

                <div class="form-control">
                    <div class="relative input-group border rounded-lg">
                        <div class="absolute mt-3 flex items-center ps-3.5">
                            <span class="material-symbols-outlined">smartphone</span>
                            <span class="badge badge-ghost py-3 ml-2">+91</span>
                        </div>
                        <input id="inputPhoneNo" v-model="form.update_phoneno" type="number" placeholder="Enter your Mobile No." class="w-full input ps-24"> 
                    </div>
                    <InputLabel labelName="update_phoneno"/>
                </div>

                <div class="modal-action">
                    <button type="submit" class="btn btn-block glass bg-primary hover:bg-primary text-white">
                        <span v-if="loading.continue" class="loading loading-spinner loading-sm"></span>
                        <span>CONTINUE</span>
                    </button>
                </div>

                
            </form>
            
        </div>
    </dialog>
</template>

<script setup lang="ts">
    import type { ToastData } from "@/assets/js/types";
    import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
    import { collection, query, where, getDocs, and } from "firebase/firestore";
    import { CompleteProfileForm } from "@/assets/js/forms";

    const currentUser = useCurrentUser();
    const db = useFirestore();
    
    watch(currentUser, (newCurrentUser) => {
        if (newCurrentUser === undefined || newCurrentUser === null) {
            //Stop processing if user is blank
            addToast({
                message: "Unknown error, Please try again (101)",
                type: "error",
                duration: 2000,
            } as ToastData);
            return;
        } else {
            isProfileCompleted();
        };
    });
    
    const loading = reactive({ continue: false });
    const completeProfileModal = reactive({ loading:true, open: false });
    const emit = defineEmits(['loadProfile'])

    //Create a form
    const form = reactive({
        update_name: '',
        update_sesaid: '',
        update_phoneno: '',
    });

    const createAccount = async () => {
        //Stop processing if user is blank
        if(!currentUser.value){
            addToast({
                message: "Unknown error, Please try again (101)",
                type: "error",
                duration: 2000,
            } as ToastData);
            return;
        };

        //Stop processing if any UI error
        const completeProfileForm = new CompleteProfileForm(form);
        if(!completeProfileForm.checkFormValid()) return;

        loading.continue = true;

        const q = query(collection(db, "users"), and(where("sesaid", "==", form.update_sesaid), where("__name__", "!=", currentUser.value?.uid as string)));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            addFieldAlert({
                message: "User already exist.",
                source: "server",
                type: "error",
                fieldid: "update_sesaid",
            })
        } else {
            await setDoc(doc(db, "users", currentUser.value?.uid as string), {
                name: form.update_name,
                sesaid: form.update_sesaid,
                phoneno: form.update_phoneno,
                createdOn: serverTimestamp(),
                admin: false,
            });
            completeProfileModal.open = false;
            emit('loadProfile');
            addToast({
                message: "Profile updated successfully!",
                type: "success",
                duration: 2000,
            } as ToastData);
        }
        loading.continue = false;
    };

    const isProfileCompleted = async () => {
        const userSnap = await getDoc(doc(db, "users", currentUser.value?.uid as string));
        completeProfileModal.loading = false;
        if (!userSnap.exists() || !userSnap.data().name || !userSnap.data().sesaid || !userSnap.data().phoneno) {
            completeProfileModal.open = true;
        } 
    };

</script>