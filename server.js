const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json({ limit: "100mb" }));

// ===============================
// FIREBASE KEY LOAD (LOCAL + RENDER)
// ===============================

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {

  serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
  );

  console.log("Firebase ENV key loaded");

} else {

  serviceAccount = require("./firebase-key.json");

  console.log("Firebase local key loaded");

}

// ===============================
// INIT FIREBASE
// ===============================

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();

// ===============================
// MIME MAP
// ===============================

const mimeMap = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",

  "video/mp4": "mp4",
  "video/quicktime": "mov",

  "application/pdf": "pdf"
};

// ===============================
// UPLOAD API
// ===============================

app.post("/upload-from-appsheet", async (req, res) => {

  try {

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl missing" });
    }

    // Download from AppSheet
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    let contentType = response.headers["content-type"];
    contentType = contentType.split(";")[0].trim();

    const ext = mimeMap[contentType];

    if (!ext) {
      return res.status(400).json({
        error: "Unsupported file type",
        received: contentType
      });
    }

    const fileName = `uploads/${Date.now()}.${ext}`;
    const file = bucket.file(fileName);

    // Upload to Firebase
    await file.save(response.data, {
      resumable: false,
      metadata: {
        contentType: contentType,
        cacheControl: "public,max-age=31536000"
      }
    });

    // ===============================
    // CREATE DIRECT STREAM URL (WHATSAPP SAFE)
    // ===============================

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "01-01-2035",
      responseDisposition: "inline"
    });

    return res.json({
      success: true,
      url: signedUrl,
      type: contentType
    });

  } catch (err) {

    console.error("UPLOAD ERROR:", err);

    return res.status(500).json({
      error: "Upload failed",
      details: err.message
    });
  }

});

// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
