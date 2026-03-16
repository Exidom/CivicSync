import {fetchWithAuth} from "/js/auth.js";

export async function uploadImage(file,spot,groupName=null) {


    const signatureData = await fetchWithAuth(
        "/cloudinary-signature",
        "POST"
    );

    if(file.size > 8_000_000){
        alert("Image must be under 8MB");
        return;
    }


    const formData = new FormData();
    const normalized = await normalizeImage(file);
    formData.append("file", normalized, file.name);
    formData.append("api_key", signatureData.apiKey);
    formData.append("timestamp", signatureData.timestamp);
    formData.append("signature", signatureData.signature);
    formData.append("folder", signatureData.folder);
    formData.append("transformation", signatureData.transformation);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    if (!response.ok) {
        throw new Error(`Server Error: ${response.error}`);
    }
    
    const data = await response.json();

    const myData = { "x": spot,"iLink": data.secure_url,"pid": data.public_id,"group":groupName}
    await fetchWithAuth("/set-ilink", "POST", myData);


    return {
        secure_url: data.secure_url,
        public_id: data.public_id
    };
}


export async function deleteImage(publicId,spot,groupName=null) {
    await fetchWithAuth("/delete-image","POST",{"pid":publicId,"spot":spot,"group":groupName});
}


async function normalizeImage(file, size = 1024){

    const img = new Image();
    const url = URL.createObjectURL(file);

    await new Promise(resolve=>{
        img.onload = resolve;
        img.src = url;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = size;
    canvas.height = size;

    const minSide = Math.min(img.width, img.height);

    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;

    ctx.drawImage(
        img,
        sx, sy, minSide, minSide,
        0, 0, size, size
    );

    return new Promise(resolve=>{
        canvas.toBlob(
            blob => resolve(blob),
            "image/jpeg",
            0.88
        );
    });
}