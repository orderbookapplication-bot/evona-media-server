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
        resumable: false,   // IMPORTANT FOR WHATSAPP
        metadata: {
          contentType: "video/mp4",
          contentDisposition: "inline", // MOBILE FIX
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
