import './_group.css';
import currentHtml from './_current.html?raw';

// Exact header and home template extracted from the app; navigation is stubbed.
export function Current() {
  return <div className="min-h-screen" dangerouslySetInnerHTML={{ __html: currentHtml }} />;
}
