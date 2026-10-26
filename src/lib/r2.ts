import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  "https://504606956cf9454e5c1a0ee6a159a338.r2.cloudflarestorage.com"
const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID || "6403d276742ca081b4908554c548089b"
const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY ||
  "e4c20157a3943c037aca4df3b10c63aa5198af0ca1aca4ac9ede5368db847dba"
const R2_BUCKET = process.env.R2_BUCKET || "autodesign-bucket"
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL || "https://cdn.artesdesignonline.com.br"

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
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
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  )

  const publicUrl = R2_PUBLIC_URL.replace(/\/$/, "")
  return `${publicUrl}/${key}`
}

export async function deleteFromR2(fileUrl: string): Promise<boolean> {
  try {
    const publicUrl = R2_PUBLIC_URL.replace(/\/$/, "")
    if (!publicUrl || !fileUrl.startsWith(publicUrl)) {
      return false
    }
    const key = fileUrl.replace(`${publicUrl}/`, "")
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    )
    return true
  } catch (err) {
    console.error("Error deleting from R2:", err)
    return false
  }
}
