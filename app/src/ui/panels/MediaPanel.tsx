import { MediaDropzone } from './MediaDropzone';
import { OrderControls } from './OrderControls';
import { MediaGrid } from './MediaGrid';
import { ProceduralMediaPicker } from './ProceduralMediaPicker';

/**
 * Your images, in card order — this list *is* the layer order.
 * Ingestion lands in a later milestone; the shape of the panel is here now.
 */
export function MediaPanel() {
  return (
    <>
      <MediaDropzone />
      <OrderControls />
      <ProceduralMediaPicker />
      <MediaGrid />
    </>
  );
}