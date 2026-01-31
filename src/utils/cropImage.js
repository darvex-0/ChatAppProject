/**
 * Creates a cropped image blob from a source image and crop area.
 * @param {string} imageSrc - The source image URL (can be a blob URL or data URL).
 * @param {Object} pixelCrop - The crop area in pixels { x, y, width, height }.
 * @returns {Promise<Blob>} - The cropped image as a Blob.
 */
export default function getCroppedImg(imageSrc, pixelCrop) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = imageSrc;

        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Set canvas size to the crop size
            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;

            // Draw the cropped image onto the canvas
            ctx.drawImage(
                image,
                pixelCrop.x,
                pixelCrop.y,
                pixelCrop.width,
                pixelCrop.height,
                0,
                0,
                pixelCrop.width,
                pixelCrop.height
            );

            // Convert canvas to blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas is empty'));
                    }
                },
                'image/jpeg',
                0.9
            );
        };

        image.onerror = () => {
            reject(new Error('Failed to load image'));
        };
    });
}
