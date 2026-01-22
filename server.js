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
// VIDEO UPLOAD API (STABLE)
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

      response.data
        .pipe(firebaseFile.createWriteStream({
          metadata: {
            contentType: "video/mp4",
            cacheControl: "public,max-age=31536000"
          }
        }))
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
// RENDER PORT
// ==============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
