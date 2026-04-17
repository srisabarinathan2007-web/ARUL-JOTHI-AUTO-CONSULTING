import { useState, useRef, ChangeEvent, useCallback } from 'react';
import { Printer, Upload, X, FileImage, Layout, Download, RefreshCw, Crop, Wand2, Check, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { cn } from '../lib/utils';
import Cropper, { Area } from 'react-easy-crop';
import { GoogleGenAI, Type } from "@google/genai";
import smartcrop from 'smartcrop';

// Lazy initialize AI to avoid crashes if the key is missing during startup
let aiInstance: any = null;
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export default function AadharPrintDashboard() {
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  
  // Cropping State
  const [cropModal, setCropModal] = useState<{
    side: 'front' | 'back';
    image: string;
  } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [ocrData, setOcrData] = useState<{ side: 'front' | 'back', text: string } | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<string | null> => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return null;

      const rotRad = (rotation * Math.PI) / 180;
      const { width: bBoxWidth, height: bBoxHeight } = {
        width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
        height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height),
      };

      canvas.width = bBoxWidth;
      canvas.height = bBoxHeight;

      ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
      ctx.rotate(rotRad);
      ctx.translate(-image.width / 2, -image.height / 2);
      ctx.drawImage(image, 0, 0);

      // Extract the cropped image
      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');

      if (!croppedCtx) return null;

      croppedCanvas.width = pixelCrop.width;
      croppedCanvas.height = pixelCrop.height;

      croppedCtx.drawImage(
        canvas,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      return croppedCanvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      console.error('Error in getCroppedImg:', error);
      return null;
    }
  };

  const handleApplyCrop = async () => {
    if (cropModal && croppedAreaPixels) {
      setIsApplyingCrop(true);
      try {
        const croppedImage = await getCroppedImg(cropModal.image, croppedAreaPixels, rotation);
        if (croppedImage) {
          if (cropModal.side === 'front') setFrontImage(croppedImage);
          else setBackImage(croppedImage);
          setCropModal(null);
          setRotation(0);
          setZoom(1);
          setCroppedAreaPixels(null);
        } else {
          alert('Failed to crop image. Please try again.');
        }
      } catch (error) {
        console.error('Apply crop failed:', error);
        alert('An error occurred while saving the cropped image.');
      } finally {
        setIsApplyingCrop(false);
      }
    }
  };

  const handleSmartCrop = async () => {
    if (!cropModal) return;
    setIsAiProcessing(true);
    try {
      const img = await createImage(cropModal.image);
      const result = await smartcrop.crop(img, { width: 86, height: 54 });
      
      if (result && result.topCrop) {
        const { x, y, width, height } = result.topCrop;
        
        // Calculate zoom and crop for react-easy-crop
        const zoomLevel = Math.min(3, img.width / width);
        setZoom(zoomLevel);
        
        // Center the crop
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        setCrop({
          x: (img.width / 2 - centerX) * (zoomLevel / (img.width / 100)),
          y: (img.height / 2 - centerY) * (zoomLevel / (img.height / 100))
        });
      }
    } catch (error) {
      console.error("SmartCrop failed:", error);
      alert("SmartCrop failed to process the image.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiOcr = async () => {
    if (!cropModal) return;
    const ai = getAI();
    if (!ai) {
      alert("AI Features require a GEMINI_API_KEY. Please add it to your environment variables to enable OCR.");
      return;
    }
    setIsOcrProcessing(true);
    try {
      const resizeImage = async (base64Str: string, maxWidth = 1024): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = base64Str;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxWidth) {
                width *= maxWidth / height;
                height = maxWidth;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          };
        });
      };

      const optimizedBase64 = await resizeImage(cropModal.image);

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: optimizedBase64,
            },
          },
          {
            text: "Extract all text from this ID card. Format it clearly. If it's an Aadhar card, extract the Name, Aadhar Number, and Address if visible.",
          },
        ],
      });

      if (response.text) {
        setOcrData({ side: cropModal.side, text: response.text });
      }
    } catch (error) {
      console.error("AI OCR failed:", error);
      alert("AI could not extract text. Please try a clearer photo.");
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleAiMagicCrop = async () => {
    if (!cropModal) return;
    const ai = getAI();
    if (!ai) {
      alert("AI Features require a GEMINI_API_KEY. Please add it to your environment variables to enable Magic Crop.");
      return;
    }
    setIsAiProcessing(true);
    try {
      const resizeImage = async (base64Str: string, maxWidth = 1024): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = base64Str;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxWidth) {
                width *= maxWidth / height;
                height = maxWidth;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          };
        });
      };

      const optimizedBase64 = await resizeImage(cropModal.image);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: optimizedBase64, mimeType: "image/jpeg" } },
            { text: "Crop this image to show only the ID card. Remove all background. Make the card horizontal and centered. Return only the edited image." }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          if (cropModal.side === 'front') setFrontImage(imageUrl);
          else setBackImage(imageUrl);
          setCropModal(null);
          return;
        }
      }
      
      alert("AI Magic Crop could not process this image. Please use Smart Fix or manual crop.");
    } catch (error) {
      console.error("AI Magic Crop failed:", error);
      alert("AI Magic Crop is currently unavailable. Please use Smart Fix.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiSmartCrop = async () => {
    if (!cropModal) return;
    const ai = getAI();
    if (!ai) {
      alert("AI Features require a GEMINI_API_KEY. Please add it to your environment variables to enable Smart Fix.");
      return;
    }
    setIsAiProcessing(true);
    try {
      // Optimize: Resize image before sending to AI
      const resizeImage = async (base64Str: string, maxWidth = 1024): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = base64Str;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxWidth) {
                width *= maxWidth / height;
                height = maxWidth;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          };
        });
      };

      const optimizedBase64 = await resizeImage(cropModal.image);

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: optimizedBase64,
            },
          },
          {
            text: "Detect the Aadhar card or ID card in this image. Find the bounding box [ymin, xmin, ymax, xmax] (0-1000 scale) and the rotation (0, 90, 180, 270) needed to make it horizontal and readable.",
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER },
              rotation: { type: Type.NUMBER }
            },
            required: ["ymin", "xmin", "ymax", "xmax", "rotation"]
          }
        }
      });

      const result = JSON.parse(response.text);
      if (result && typeof result.ymin === 'number') {
        // 1. Apply Rotation
        setRotation(result.rotation || 0);
        
        // 2. Calculate Zoom
        const cardHeight = (result.ymax - result.ymin) / 1000;
        const cardWidth = (result.xmax - result.xmin) / 1000;
        
        // We want the card to fill about 90% of the crop area
        // Standard Aadhar aspect ratio is 86/54
        const targetAspect = 86 / 54;
        const currentAspect = cardWidth / cardHeight;
        
        let zoomLevel = 1;
        if (currentAspect > targetAspect) {
          zoomLevel = 0.9 / cardWidth;
        } else {
          zoomLevel = 0.9 / (cardHeight * targetAspect);
        }
        
        setZoom(Math.max(1, Math.min(3, zoomLevel * 1.2))); // Add a little extra zoom
        
        // 3. Center the crop
        // In react-easy-crop, (0,0) is center. 
        // We need to translate the image so the card's center is at the crop center.
        const centerX = (result.xmin + result.xmax) / 2;
        const centerY = (result.ymin + result.ymax) / 2;
        
        // This is a heuristic for centering
        setCrop({
          x: (500 - centerX) * 0.5,
          y: (500 - centerY) * 0.5
        });
      } else {
        alert("AI could not clearly identify the card. Please adjust manually.");
      }
    } catch (error) {
      console.error("AI Smart Crop failed:", error);
      alert("AI Smart Fix is currently unavailable. Please use manual controls.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        
        // Open the modal first so the user sees the image is being processed
        setCropModal({ side, image: result });
        
        // Automatically trigger the Magic Crop AI for every upload
        // We call the logic directly here using the 'result' string
        const ai = getAI();
        if (!ai) return; // Skip auto-processing if AI is not available

        setIsAiProcessing(true);
        try {
          const resizeImage = async (base64Str: string, maxWidth = 1024): Promise<string> => {
            return new Promise((resolve) => {
              const img = new Image();
              img.src = base64Str;
              img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                  if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                  }
                } else {
                  if (height > maxWidth) {
                    width *= maxWidth / height;
                    height = maxWidth;
                  }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
              };
            });
          };

          const optimizedBase64 = await resizeImage(result);

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [
                { inlineData: { data: optimizedBase64, mimeType: "image/jpeg" } },
                { text: "Crop this image to show only the ID card. Remove all background. Make the card horizontal and centered. Return only the edited image." }
              ]
            },
            config: {
              imageConfig: {
                aspectRatio: "16:9",
              }
            }
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) {
              const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              if (side === 'front') setFrontImage(imageUrl);
              else setBackImage(imageUrl);
              setCropModal(null);
              return;
            }
          }
        } catch (error) {
          console.error("Auto Magic Crop failed:", error);
          // If auto-crop fails, we just leave the modal open for manual adjustment
        } finally {
          setIsAiProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = (side: 'front' | 'back') => {
    if (side === 'front') {
      setFrontImage(null);
      if (frontInputRef.current) frontInputRef.current.value = '';
    } else {
      setBackImage(null);
      if (backInputRef.current) backInputRef.current.value = '';
    }
  };

  const generatePDF = () => {
    if (!frontImage && !backImage) {
      alert('Please upload at least one image');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Aadhar card standard size is 86mm x 54mm
    const cardWidth = 86;
    const cardHeight = 54;
    const margin = 10;

    if (layout === 'vertical') {
      // Front Image
      if (frontImage) {
        doc.addImage(frontImage, 'JPEG', (210 - cardWidth) / 2, margin, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect((210 - cardWidth) / 2, margin, cardWidth, cardHeight);
      }

      // Back Image
      if (backImage) {
        const yPos = margin + cardHeight + 5;
        doc.addImage(backImage, 'JPEG', (210 - cardWidth) / 2, yPos, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect((210 - cardWidth) / 2, yPos, cardWidth, cardHeight);
      }
    } else {
      // Horizontal layout (side by side if possible, but A4 width is 210, 86*2 = 172, so it fits)
      const startX = (210 - (cardWidth * 2 + 5)) / 2;
      
      if (frontImage) {
        doc.addImage(frontImage, 'JPEG', startX, margin, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect(startX, margin, cardWidth, cardHeight);
      }

      if (backImage) {
        const xPos = startX + cardWidth + 5;
        doc.addImage(backImage, 'JPEG', xPos, margin, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect(xPos, margin, cardWidth, cardHeight);
      }
    }

    doc.save(`Aadhar_Print_${new Date().getTime()}.pdf`);
  };

  const handlePrint = () => {
    if (!frontImage && !backImage) {
      alert('Please upload at least one image');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const cardWidth = 86;
    const cardHeight = 54;
    const margin = 10;

    if (layout === 'vertical') {
      if (frontImage) {
        doc.addImage(frontImage, 'JPEG', (210 - cardWidth) / 2, margin, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect((210 - cardWidth) / 2, margin, cardWidth, cardHeight);
      }
      if (backImage) {
        const yPos = margin + cardHeight + 5;
        doc.addImage(backImage, 'JPEG', (210 - cardWidth) / 2, yPos, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect((210 - cardWidth) / 2, yPos, cardWidth, cardHeight);
      }
    } else {
      const startX = (210 - (cardWidth * 2 + 5)) / 2;
      if (frontImage) {
        doc.addImage(frontImage, 'JPEG', startX, margin, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect(startX, margin, cardWidth, cardHeight);
      }
      if (backImage) {
        const xPos = startX + cardWidth + 5;
        doc.addImage(backImage, 'JPEG', xPos, margin, cardWidth, cardHeight);
        doc.setDrawColor(200);
        doc.rect(xPos, margin, cardWidth, cardHeight);
      }
    }

    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-2 h-12 bg-modern-blue rounded-full shadow-lg shadow-modern-blue/20" />
          <div>
            <h2 className="text-3xl font-display font-bold text-modern-text tracking-tight uppercase leading-none">Aadhar Print</h2>
            <p className="text-modern-muted text-[10px] font-black uppercase tracking-[0.2em] mt-2">Professional ID Card Layout Engine</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white border border-modern-border rounded-2xl p-1.5 shadow-sm">
            <button
              onClick={() => setLayout('vertical')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                layout === 'vertical' ? "bg-modern-blue text-white shadow-lg shadow-modern-blue/20" : "text-modern-muted hover:text-modern-text"
              )}
            >
              <Layout className="w-4 h-4" />
              Vertical
            </button>
            <button
              onClick={() => setLayout('horizontal')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                layout === 'horizontal' ? "bg-modern-blue text-white shadow-lg shadow-modern-blue/20" : "text-modern-muted hover:text-modern-text"
              )}
            >
              <Layout className="w-4 h-4 rotate-90" />
              Horizontal
            </button>
          </div>
          <button
            onClick={handlePrint}
            disabled={!frontImage && !backImage}
            className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-3 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Print Now
          </button>
          <button
            onClick={generatePDF}
            disabled={!frontImage && !backImage}
            className="px-8 py-4 bg-modern-blue text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-modern-blue/90 transition-all flex items-center gap-3 shadow-lg shadow-modern-blue/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Front Side */}
        <div className="modern-card rounded-[2.5rem] p-10 space-y-8 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-modern-blue/10 group-hover:text-modern-blue transition-colors">
                <FileImage className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-modern-text uppercase tracking-widest">Front Side</h3>
                <p className="text-[10px] text-modern-muted font-bold uppercase tracking-wider mt-0.5">Primary Identity</p>
              </div>
            </div>
            {frontImage && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCropModal({ side: 'front', image: frontImage })}
                  className="p-3 text-slate-400 hover:text-modern-blue hover:bg-slate-50 rounded-xl transition-all"
                  title="Crop / Edit"
                >
                  <Crop className="w-5 h-5" />
                </button>
                <button
                  onClick={() => clearImage('front')}
                  className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div 
            onClick={() => !frontImage && frontInputRef.current?.click()}
            className={cn(
              "relative aspect-[86/54] rounded-3xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center gap-4",
              frontImage ? "border-modern-blue/20 bg-modern-blue/5 cursor-default" : "border-modern-border bg-slate-50 hover:border-modern-blue/40 hover:bg-modern-blue/5 cursor-pointer"
            )}
          >
            {frontImage ? (
              <img src={frontImage} alt="Front Preview" className="w-full h-full object-contain p-4" />
            ) : (
              <>
                <div className="p-5 bg-white rounded-2xl shadow-sm text-slate-300 group-hover:text-modern-blue transition-colors border border-modern-border">
                  <Upload className="w-10 h-10" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-modern-muted uppercase tracking-widest">Upload Front Image</p>
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mt-2">Click or Drag & Drop</p>
                </div>
              </>
            )}
            <input 
              type="file" 
              ref={frontInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => handleImageUpload(e, 'front')} 
            />
          </div>
        </div>

        {/* Back Side */}
        <div className="modern-card rounded-[2.5rem] p-10 space-y-8 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-modern-blue/10 group-hover:text-modern-blue transition-colors">
                <FileImage className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-modern-text uppercase tracking-widest">Back Side</h3>
                <p className="text-[10px] text-modern-muted font-bold uppercase tracking-wider mt-0.5">Address & Details</p>
              </div>
            </div>
            {backImage && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCropModal({ side: 'back', image: backImage })}
                  className="p-3 text-slate-400 hover:text-modern-blue hover:bg-slate-50 rounded-xl transition-all"
                  title="Crop / Edit"
                >
                  <Crop className="w-5 h-5" />
                </button>
                <button
                  onClick={() => clearImage('back')}
                  className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div 
            onClick={() => !backImage && backInputRef.current?.click()}
            className={cn(
              "relative aspect-[86/54] rounded-3xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center gap-4",
              backImage ? "border-modern-blue/20 bg-modern-blue/5 cursor-default" : "border-modern-border bg-slate-50 hover:border-modern-blue/40 hover:bg-modern-blue/5 cursor-pointer"
            )}
          >
            {backImage ? (
              <img src={backImage} alt="Back Preview" className="w-full h-full object-contain p-4" />
            ) : (
              <>
                <div className="p-5 bg-white rounded-2xl shadow-sm text-slate-300 group-hover:text-modern-blue transition-colors border border-modern-border">
                  <Upload className="w-10 h-10" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-modern-muted uppercase tracking-widest">Upload Back Image</p>
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mt-2">Click or Drag & Drop</p>
                </div>
              </>
            )}
            <input 
              type="file" 
              ref={backInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => handleImageUpload(e, 'back')} 
            />
          </div>
        </div>
      </div>

      {/* Cropping Modal */}
      {cropModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setCropModal(null)} />
          <div className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] border border-modern-border">
            <div className="p-6 border-b border-modern-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-modern-blue/5 rounded-2xl text-modern-blue">
                  <Crop className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-modern-text uppercase tracking-tight">
                    Crop & Rotate {cropModal.side}
                  </h3>
                  <p className="text-modern-muted text-[10px] font-black uppercase tracking-widest mt-0.5">Adjust your ID card image</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSmartCrop}
                  disabled={isAiProcessing}
                  className="px-6 py-3 bg-slate-50 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2 disabled:opacity-50 border border-modern-border"
                  title="Use SmartCrop.js (Non-AI)"
                >
                  {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-4 h-4" />}
                  Auto Fit
                </button>
                <button
                  onClick={handleAiSmartCrop}
                  disabled={isAiProcessing}
                  className="px-6 py-3 bg-slate-50 text-modern-blue rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2 disabled:opacity-50 border border-modern-border"
                  title="AI Detection & Zoom"
                >
                  {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Smart Fix
                </button>
                <button
                  onClick={handleAiMagicCrop}
                  disabled={isAiProcessing}
                  className="px-6 py-3 bg-modern-blue/10 text-modern-blue rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-modern-blue/20 transition-all flex items-center gap-2 disabled:opacity-50 border border-modern-blue/20"
                  title="AI Image-to-Image Magic Crop"
                >
                  {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Magic Crop
                </button>
                <button
                  onClick={handleAiOcr}
                  disabled={isOcrProcessing}
                  className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                  title="Extract Text from Card"
                >
                  {isOcrProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Extract Text
                </button>
                <button
                  onClick={() => setCropModal(null)}
                  className="p-3 text-slate-400 hover:text-modern-text hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative bg-slate-900 flex flex-col">
              <div className="flex-1 relative">
                <Cropper
                  image={cropModal.image}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={86 / 54}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                />
              </div>
              
              {ocrData && ocrData.side === cropModal.side && (
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-modern-border shadow-2xl z-[110] max-h-[40%] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-modern-text uppercase tracking-widest">Extracted Text</h4>
                    <button onClick={() => setOcrData(null)} className="text-modern-muted hover:text-modern-text"><X className="w-4 h-4" /></button>
                  </div>
                  <pre className="text-[10px] font-mono text-modern-muted whitespace-pre-wrap leading-relaxed">{ocrData.text}</pre>
                </div>
              )}
            </div>

            <div className="p-8 bg-white border-t border-modern-border space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest">Zoom</label>
                    <span className="text-[10px] font-black text-modern-blue">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-modern-blue"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest">Rotation</label>
                    <span className="text-[10px] font-black text-modern-blue">{rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-modern-blue"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setRotation((rotation + 90) % 360)}
                  className="flex-1 py-4 bg-slate-50 text-modern-muted rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2 border border-modern-border"
                >
                  <RefreshCw className="w-4 h-4" />
                  Rotate 90°
                </button>
                <button
                  onClick={handleApplyCrop}
                  disabled={isApplyingCrop || !croppedAreaPixels}
                  className="flex-[2] py-4 bg-modern-blue text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-modern-blue/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-modern-blue/20 disabled:opacity-50"
                >
                  {isApplyingCrop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isApplyingCrop ? 'Processing...' : 'Apply & Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Section */}
      <div className="modern-card rounded-[3rem] p-10 space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-modern-blue/5 rounded-2xl text-modern-blue">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-modern-text uppercase tracking-widest">Print Preview</h3>
              <p className="text-[10px] text-modern-muted font-bold uppercase tracking-wider mt-0.5">A4 Scale Visualization</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-modern-muted uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl border border-modern-border">
            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20" />
            Ready to Print
          </div>
        </div>

        <div className="bg-slate-50 rounded-[2.5rem] p-16 flex justify-center border border-modern-border relative overflow-hidden">
          <div className="bg-white w-[210px] h-[297px] shadow-2xl border border-slate-200 p-6 flex flex-col gap-4 scale-[1.8] origin-top transition-transform duration-500 hover:scale-[1.9]">
            {layout === 'vertical' ? (
              <>
                <div className="w-full aspect-[86/54] border border-slate-100 bg-slate-50/50 flex items-center justify-center overflow-hidden rounded-sm">
                  {frontImage ? <img src={frontImage} className="w-full h-full object-contain" /> : <span className="text-[6px] text-slate-300 uppercase font-black tracking-widest">Front</span>}
                </div>
                <div className="w-full aspect-[86/54] border border-slate-100 bg-slate-50/50 flex items-center justify-center overflow-hidden rounded-sm">
                  {backImage ? <img src={backImage} className="w-full h-full object-contain" /> : <span className="text-[6px] text-slate-300 uppercase font-black tracking-widest">Back</span>}
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 aspect-[86/54] border border-slate-100 bg-slate-50/50 flex items-center justify-center overflow-hidden rounded-sm">
                  {frontImage ? <img src={frontImage} className="w-full h-full object-contain" /> : <span className="text-[6px] text-slate-300 uppercase font-black tracking-widest">Front</span>}
                </div>
                <div className="flex-1 aspect-[86/54] border border-slate-100 bg-slate-50/50 flex items-center justify-center overflow-hidden rounded-sm">
                  {backImage ? <img src={backImage} className="w-full h-full object-contain" /> : <span className="text-[6px] text-slate-300 uppercase font-black tracking-widest">Back</span>}
                </div>
              </div>
            )}
          </div>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-slate-900/5" />
        </div>
        <div className="h-[250px]" /> {/* Spacer for the scaled preview */}
      </div>
    </div>
  );
}
