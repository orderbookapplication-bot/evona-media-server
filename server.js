const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// ==============================
// FIREBASE INIT FROM ENV
// ==============================

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// ==============================
// WHATSAPP MOBILE SAFE VIDEO API
// ==============================

app.post("/upload-from-appsheet", async (req, res) => {

  try {

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl missing" });
    }

    console.log("Downloading video...");

    const response = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "stream"
    });

    const fileName = `uploads/${Date.now()}.mp4`;
    const firebaseFile = bucket.file(fileName);

    await new Promise((resolve, reject) => {

      const writeStream = firebaseFile.createWriteStream({
        resumable: false,
        metadata: {
          contentType: "video/mp4",
          contentDisposition: "inline",
          cacheControl: "public, max-age=31536000"
        }
      });

      response.data
        .pipe(writeStream)
        .on("finish", resolve)
        .on("error", reject);

    });

    await firebaseFile.makePublic();

    const publicUrl =
      `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    console.log("Upload Success:", publicUrl);

    return res.json({
      success: true,
      url: publicUrl
    });

  } catch (err) {

    console.error("UPLOAD ERROR:", err);

    return res.status(500).json({
      error: "Upload failed"
    });

  }

});

// ==============================
// SERVER START (RENDER)
// ==============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
