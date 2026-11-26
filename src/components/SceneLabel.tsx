import { useEffect, useMemo } from 'react';
import { CanvasTexture } from 'three';

export function LabelSprite({
  text,
  position,
  color = '#ffffff',
  width = 2.2,
  fontSize = 27,
}: {
  text: string;
  position: [number, number, number];
  color?: string;
  width?: number;
  fontSize?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(11,14,18,.9)';
    ctx.fillRect(2, 2, 508, 92);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(2.5, 2.5, 507, 91);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.length > 34 ? `${text.slice(0, 33)}…` : text, 256, 49, 480);
    const map = new CanvasTexture(canvas);
    map.colorSpace = 'srgb';
    return map;
  }, [color, fontSize, text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[width, width * (96 / 512), 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}
