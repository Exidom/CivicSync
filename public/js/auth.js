import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onIdTokenChanged, signOut} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

export async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        
        //(Safe for browser-only use)
        localStorage.setItem("firebaseToken", idToken);
        localStorage.setItem("userEmail", result.user.email);
        return result.user;

    } catch (error) {
        throw error;
    }
}

export async function fetchWithAuth(url, method = "GET", body = null) {

    const token = localStorage.getItem("firebaseToken");
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const options = {
        method: method,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(url, options);

        if (response.status === 401) {
            localStorage.removeItem("firebaseToken");
            window.location.href = "/login";
            return;
        }

        if (response.status === 403) {
            throw new Error("Permission Denied");
        }

        return await response.json();
    } catch (err) {
        throw err;
    }
}


onIdTokenChanged(auth, async (user) => {
    if (user) {
        const token = await user.getIdToken();
        localStorage.setItem("firebaseToken", token);
        //if (window.location.href === "/login") {
            //window.location.href = "/home";
        //}
    } else {
        localStorage.removeItem("firebaseToken");
        //if (window.location.href !== "/login") {
        //   window.location.href = "/login";
        //}
    }
});

export async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        throw error;
    }
}