const MAX_UPLOAD_DIMENSION = 1600;
const MAX_UPLOAD_BYTES = 1_400_000;
const MAX_SOURCE_BYTES = 10_000_000;
const INITIAL_JPEG_QUALITY = 0.84;
const MIN_JPEG_QUALITY = 0.58;
const JPEG_QUALITY_STEP = 0.08;
const MIN_DIMENSION_AFTER_RESIZE = 960;

/**
 * 파일 이름의 확장자를 지정한 새 확장자로 교체합니다.
 * (예: 'photo.png' -> 'photo.jpg')
 */
function replaceExtension(fileName: string, nextExtension: string) {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) {
    return `${fileName}.${nextExtension}`;
  }
  return `${fileName.slice(0, dotIndex)}.${nextExtension}`;
}

/**
 * 브라우저 환경에서 이미지 파일을 읽어와 HTML Canvas 객체로 변환하여 그립니다.
 * 이미지의 최대 허용 크기(MAX_UPLOAD_DIMENSION)에 맞추어 스케일을 조정합니다.
 */
async function drawImageToCanvas(file: File) {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('이미지를 읽지 못했어요.'));
      element.src = imageUrl;
    });

    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('이미지 캔버스를 준비하지 못했어요.');
    }
    context.drawImage(image, 0, 0, width, height);
    return { canvas, width, height };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * HTML Canvas에 그려진 이미지를 지정한 파일 타입과 품질(Quality)을 적용하여 Blob 객체로 변환합니다.
 */
async function canvasToBlob(canvas: HTMLCanvasElement, fileType: string, quality?: number) {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), fileType, quality);
  });
}

/**
 * 파일의 크기를 기반으로, 클라이언트 사이드에서 이미지 최적화(압축/리사이즈)를 진행할지 결정합니다.
 */
function shouldOptimizeImage(file: File) {
  return file.size > MAX_UPLOAD_BYTES || file.size > MAX_SOURCE_BYTES * 0.35;
}

/**
 * 캔버스의 이미지를 JPEG로 압축하면서 화질을 단계적으로 낮추어 허용 용량(MAX_UPLOAD_BYTES) 이하가 되도록 합니다.
 */
async function compressCanvas(canvas: HTMLCanvasElement) {
  let quality = INITIAL_JPEG_QUALITY;
  let blob: Blob | null = null;

  while (quality >= MIN_JPEG_QUALITY) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!blob) {
      return null;
    }
    if (blob.size <= MAX_UPLOAD_BYTES) {
      return blob;
    }
    quality -= JPEG_QUALITY_STEP;
  }

  return blob;
}

/**
 * 이미 압축했음에도 용량이 크다면 이미지의 해상도(크기) 자체를 75% 수준으로 한 번 더 줄이는 역할을 합니다.
 */
function shrinkCanvas(canvas: HTMLCanvasElement) {
  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = Math.max(MIN_DIMENSION_AFTER_RESIZE, Math.round(canvas.width * 0.75));
  resizedCanvas.height = Math.max(MIN_DIMENSION_AFTER_RESIZE, Math.round(canvas.height * 0.75));
  const context = resizedCanvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
  return resizedCanvas;
}

/**
 * 사용자가 선택한 원본 이미지 파일을 받아, 서버 업로드에 적합하도록
 * 클라이언트 단에서 해상도 조정 및 화질 최적화를 거친 새로운 File 객체를 반환합니다.
 * 이미지 최적화가 필요 없거나 오류가 발생하면 원본 파일을 그대로 반환합니다.
 */
export async function prepareReviewImageUpload(file: File) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }
  if (!file.type.startsWith('image/')) {
    return file;
  }
  if (!shouldOptimizeImage(file)) {
    return file;
  }

  try {
    const { canvas } = await drawImageToCanvas(file);
    let compressedBlob = await compressCanvas(canvas);

    if (!compressedBlob) {
      return file;
    }

    if (compressedBlob.size > MAX_UPLOAD_BYTES) {
      const resizedCanvas = shrinkCanvas(canvas);
      if (resizedCanvas) {
        const resizedBlob = await compressCanvas(resizedCanvas);
        if (resizedBlob) {
          compressedBlob = resizedBlob;
        }
      }
    }

    if (compressedBlob.size >= file.size && compressedBlob.size > MAX_UPLOAD_BYTES) {
      return file;
    }

    return new File([compressedBlob], replaceExtension(file.name, 'jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
