<template>
    <div class="login join join-vertical">
        <form id="formLoginAccount" @submit.prevent="loginAdminAccount">
            <label class="input input-bordered flex items-center gap-2 join-item">
                <span class="material-symbols-outlined">person</span>
                <input v-model="form.login_username" type="text" class="grow" placeholder="Username" />
            </label>
            <label class="input input-bordered flex items-center gap-2 join-item">
                <span class="material-symbols-outlined">key</span>
                <input autocomplete="false" v-model="form.login_password" type="password" class="grow" placeholder="Password" />
            </label>
            <button class="btn btn-primary join-item">LOGIN</button>
        </form>

    </div>
</template>

<script setup lang="ts">

const router = useRouter();

//Create a form
const form = reactive({
    login_username: '',
    login_password: ''
});

const loginAdminAccount = () => {

    if (form.login_username == "" && form.login_password == "") {
        router.replace("/admin/dashboard")
    } else {
        addToast({
            message: 'Invalid password',
            type: 'error',
            duration: 3000
        })
    }

}
</script>