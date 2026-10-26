import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

export async function uploadToR2(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  folder = "estoque"
): Promise<string> {
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
  const key = `${folder}/${Date.now()}-${cleanFileName}`

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  )

  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
  return `${publicUrl}/${key}`
}

export async function deleteFromR2(fileUrl: string): Promise<boolean> {
  try {
    const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "")
    if (!publicUrl || !fileUrl.startsWith(publicUrl)) {
      return false
    }
    const key = fileUrl.replace(`${publicUrl}/`, "")
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      })
    )
    return true
  } catch (err) {
    console.error("Error deleting from R2:", err)
    return false
  }
}
