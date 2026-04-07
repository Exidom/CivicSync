import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBEOnJWtZyxaYacVuzp7D-JYgekrtgOUGU",
    authDomain: "civicsync-488921.firebaseapp.com",
    projectId: "civicsync-488921",
    storageBucket: "civicsync-488921.firebasestorage.app",
    messagingSenderId: "727350141221",
    appId: "1:727350141221:web:62386b1a64ee80b05ebacc",
    measurementId: "G-YNM99SDCLL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const getAuthenticatedUser = () => {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });
};

export async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, provider);
        const res = await fetchWithAuth("/create-user", "POST");
        localStorage.setItem('uid', res.uid);
        return result;

    } catch (error) {
        throw error;
    }
}

const getRequestOptions = (token, method, body) => ({
    method: method,
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    },
    ...(body && { body: JSON.stringify(body) })
});

export async function fetchWithAuth(url, method = "GET", body = null) {

    let user = auth.currentUser;
    if (!user) user = await getAuthenticatedUser();
    if (!user) {
        window.location.href = "/login";
        return;
    }

    try {
        let token = await user.getIdToken();
        let response = await fetch(url, getRequestOptions(token, method, body));      

        if (response.status === 401) {
            await signOut(auth);
            window.location.href = "/login";
            return;//nothing
        }

        
        if (!response.ok) {
            const errorData = await response.json();//fixed
            return { error: errorData.error || response.statusText, status: response.status };
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

export async function handleLogout() {
    try {
        await signOut(auth);
        localStorage.removeItem('uid');
    } catch (error) {
        throw error;
    }
}