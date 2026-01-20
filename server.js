const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ===== FIREBASE KEY FROM ENV =====
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON);

// ===== INIT FIREBASE =====
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// ===== MEDIA TYPE DETECTOR =====
function detectWhatsappType(mime) {

  if (mime.startsWith("image")) return "image";
  if (mime.startsWith("video")) return "video";
  if (mime === "application/pdf") return "document";

  return "document";
}

// ===== MAIN API =====
app.post("/upload-from-appsheet", async (req, res) => {

  try {

    const fileUrl = req.body.fileUrl;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: "fileUrl missing"
      });
    }

    // Extract file extension
    const cleanUrl = fileUrl.split("?")[0];
    const ext = path.extname(cleanUrl) || ".bin";

    const fileName = `uploads/media_${Date.now()}${ext}`;

    // Download file
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    const buffer = response.data;
    const mimeType = response.headers["content-type"];

    // Upload to Firebase
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType
      }
    });

    // Make public
    await file.makePublic();

    const publicUrl =
      `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    const whatsappType = detectWhatsappType(mimeType);

    // Response
    res.json({
      success: true,
      publicUrl: publicUrl,
      mimeType: mimeType,
      whatsappType: whatsappType
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      error: "Upload failed"
    });

  }

});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
