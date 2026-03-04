import {fetchWithAuth} from "/js/auth.js";

export async function uploadImage(file) {


    const signatureData = await fetchWithAuth(
        "/cloudinary-signature",
        "POST"
    );


    const formData = new FormData();
    formData.append("file", file);
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

    console.log(response);

    if (!response.ok) {
        throw new Error("Cloudinary upload failed");
    }

    const data = await response.json();

    return {
        secure_url: data.secure_url,
        public_id: data.public_id
    };
}


export async function deleteImage(publicId) {
    await fetchWithAuth(
        "/api/delete-image",
        "DELETE",
        { publicId }
    );
}