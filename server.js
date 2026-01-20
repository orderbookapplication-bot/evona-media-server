const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// Load Firebase Service Key
const serviceAccount = require("./firebase-key.json");

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// =============================
// Upload From AppSheet Endpoint
// =============================
app.post("/upload-from-appsheet", async (req, res) => {

  try {

    const fileUrl = req.body.fileUrl;

    if (!fileUrl) {
      return res.status(400).json({
        error: "fileUrl missing"
      });
    }

    console.log("Downloading from AppSheet...");

    // Download file as STREAM
    const response = await axios({
      url: fileUrl,
      method: "GET",
      responseType: "stream",
      timeout: 0
    });

    const contentType =
      response.headers["content-type"] || "video/mp4";

    const fileName = `evona/${Date.now()}.mp4`;

    console.log("Uploading to Firebase:", fileName);

    const file = bucket.file(fileName);

    const firebaseStream = file.createWriteStream({
      metadata: {
        contentType: contentType
      }
    });

    // Pipe AppSheet stream → Firebase
    response.data.pipe(firebaseStream);

    firebaseStream.on("error", (err) => {
      console.error("Firebase stream error:", err);
      res.status(500).json({
        error: "Firebase upload failed"
      });
    });

    firebaseStream.on("finish", async () => {

      console.log("Upload finished, making public...");

      // Make file public (correct way)
      await file.makePublic();

      const publicUrl =
        `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      console.log("Public URL:", publicUrl);

      res.json({
        success: true,
        whatsappUrl: publicUrl
      });

    });

  } catch (error) {

    console.error("Download error:", error);

    res.status(500).json({
      error: "Download failed"
    });

  }

});

// =============================
// Start Server
// =============================
app.listen(3000, () => {
  console.log("Evona Media Server Running on Port 3000");
});
