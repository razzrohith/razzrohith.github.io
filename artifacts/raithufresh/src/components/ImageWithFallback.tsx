import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  fallbackIcon?: React.ReactNode;
  containerClassName?: string;
}

export default function ImageWithFallback({
  src,
  alt,
  fallbackSrc = "/assets/images/produce/default-produce.png",
  fallbackIcon = <ImageIcon className="w-8 h-8 text-muted-foreground/50" />,
  className = "",
  containerClassName = "",
  ...props
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const finalSrc = (!src || error) ? fallbackSrc : src;

  return (
    <div className={`relative overflow-hidden bg-muted/20 flex items-center justify-center ${containerClassName}`}>
      {(!loaded || error) && !fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
          {fallbackIcon}
        </div>
      )}
      <img
        src={finalSrc}
        alt={alt || "Image"}
        onError={() => setError(true)}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        className={`transition-opacity duration-300 w-full h-full object-cover ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
        {...props}
      />
    </div>
  );
}
