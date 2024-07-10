import type { FirestoreUserProfile } from "@/assets/js/types";

export const profile = () => useState<FirestoreUserProfile>(
    "profile", () => ({} as FirestoreUserProfile)
);

export const getProfile = () => computed(()=>profile()).value;

export const setProfile = (data: FirestoreUserProfile) => {
    profile().value = {...data}
};