import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export const cloudinaryClient = cloudinary;
export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

export const createDirectUploadSignature = (folder: string) => {
  if (!isCloudinaryConfigured || !cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary belum dikonfigurasi di environment.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinaryClient.utils.api_sign_request(
    { folder, timestamp },
    apiSecret
  );

  return { cloudName, apiKey, folder, timestamp, signature };
};

export const uploadToCloudinary = async (image: string, folder: string) => {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary belum dikonfigurasi. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET di environment.');
  }

  const result = await cloudinaryClient.uploader.upload(image, {
    folder,
    resource_type: 'auto',
    quality: 'auto',
    fetch_format: 'auto',
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
};
