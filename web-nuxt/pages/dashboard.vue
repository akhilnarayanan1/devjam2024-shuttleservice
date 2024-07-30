<template>
    <div>
      <div v-if="loading.page"><CircleLoad /></div>
      <div v-else>
        <Navbar />
        <CompleteProfile @load-profile="loadProfile" />
        <div v-if="userProfile.admin">
          <AdminDashboard />
        </div>
        <div v-else>
          <UserDashboard />
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  
    import { doc, getDoc } from "firebase/firestore";
    import type { FirestoreUserProfile, ToastData } from "@/assets/js/types";
    import { useFirestore, useIsCurrentUserLoaded } from "vuefire";
  
    //Set and clear field alert on page load
    clearFieldAlerts();
  
    const loading = reactive({ page: true });
  
    const currentUser = useCurrentUser();
    const db = useFirestore();

    const userProfile = getProfile();
  
    watchEffect(() => loading.page = currentUser == undefined);
  
    onMounted(() => { 
      if (!useIsCurrentUserLoaded().value) {
        watch(currentUser, (newCurrentUser) => loadProfile());
      } else {
        loadProfile();
      }
    });
  
    const loadProfile = async () => {
      //Stop processing if user is blank
      if (!currentUser.value) {
          addToast({
            message: "Unknown error, Please try again (401)",
            type: "error",
            duration: 2000,
          } as ToastData);
          return;
        };
      const querySnapshot = await getDoc(doc(db, "users", currentUser.value?.uid as string));
  
      if (!querySnapshot.exists()) {
        addToast({
          message: "Please complete your profile to continue.",
          type: "error",
          duration: 2000,
        } as ToastData);
        return;
      };
  
      const profile = querySnapshot.data() as FirestoreUserProfile
      setProfile(profile);
  
    };
  
  </script>