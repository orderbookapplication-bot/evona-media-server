const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();
app.use(express.json({ limit: "100mb" }));


// ================================
// LOAD FIREBASE KEY FROM RENDER ENV
// ================================

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT ENV missing");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
);


// ================================
// INITIALIZE FIREBASE
// ================================

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "evona-media.firebasestorage.app"
});

const bucket = admin.storage().bucket();


// ================================
// MIME TYPE MAP
// ================================

const mimeMap = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",

  "video/mp4": "mp4",
  "video/quicktime": "mov",

  "application/pdf": "pdf"
};


// ================================
// MAIN API ROUTE
// ================================

app.post("/upload-from-appsheet", async (req, res) => {

  try {

    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: "fileUrl missing"
      });
    }

    console.log("Downloading:", fileUrl);

    // Download file from AppSheet
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    // Fix content-type (remove charset=utf-8)
    let contentType = response.headers["content-type"];

    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: "Content-Type missing"
      });
    }

    contentType = contentType.split(";")[0].trim();

    console.log("Detected Type:", contentType);

    const extension = mimeMap[contentType];

    if (!extension) {
      return res.status(400).json({
        success: false,
        error: "Unsupported file type",
        received: contentType
      });
    }

    const fileName = `uploads/${Date.now()}.${extension}`;

    const file = bucket.file(fileName);

    // Upload to Firebase Storage
    await file.save(response.data, {
      metadata: {
        contentType: contentType
      }
    });

    // Make public
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    console.log("Uploaded:", publicUrl);

    // SUCCESS RESPONSE
    return res.json({
      success: true,
      url: publicUrl,
      type: contentType
    });

  } catch (error) {

    console.error("UPLOAD ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      message: error.message
    });

  }

});


// ================================
// RENDER PORT BINDING
// ================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Evona Media Server Running on Port", PORT);
});
