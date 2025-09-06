/**
 * Utility functions for formatting response text for better readability
 * Following KISS principles - simple, effective formatting
 */

export function formatResponse(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Split into paragraphs at double line breaks
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');
}

export function formatResponseAsHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Split into paragraphs
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .map(paragraph => {
      // Handle bullet points
      if (paragraph.includes('\n• ') || paragraph.includes('\n- ')) {
        const lines = paragraph.split('\n');
        const formatted = lines.map(line => {
          if (line.startsWith('• ') || line.startsWith('- ')) {
            return `<li>${line.substring(2)}</li>`;
          }
          return line;
        });
        
        // Wrap in ul if we have list items
        const hasListItems = formatted.some(line => line.startsWith('<li>'));
        if (hasListItems) {
          const listItems = formatted.filter(line => line.startsWith('<li>'));
          const nonListItems = formatted.filter(line => !line.startsWith('<li>'));
          return `${nonListItems.join('<br>')}${nonListItems.length > 0 ? '<br>' : ''}<ul class="list-disc ml-4 space-y-1">${listItems.join('')}</ul>`;
        }
      }
      
      // Handle numbered lists
      if (paragraph.match(/\n\d+\./)) {
        const lines = paragraph.split('\n');
        const formatted = lines.map(line => {
          if (line.match(/^\d+\./)) {
            return `<li>${line.replace(/^\d+\.\s*/, '')}</li>`;
          }
          return line;
        });
        
        const hasListItems = formatted.some(line => line.startsWith('<li>'));
        if (hasListItems) {
          const listItems = formatted.filter(line => line.startsWith('<li>'));
          const nonListItems = formatted.filter(line => !line.startsWith('<li>'));
          return `${nonListItems.join('<br>')}${nonListItems.length > 0 ? '<br>' : ''}<ol class="list-decimal ml-4 space-y-1">${listItems.join('')}</ol>`;
        }
      }
      
      // Bold text for key terms (simple ** formatting)
      let formatted = paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Handle line breaks within paragraphs
      formatted = formatted.replace(/\n/g, '<br>');
      
      return `<p>${formatted}</p>`;
    })
    .join('');
}

export function isListResponse(text: string): boolean {
  if (!text) return false;
  return text.includes('• ') || text.includes('- ') || text.match(/\d+\./) !== null;
}

export function hasMultipleParagraphs(text: string): boolean {
  if (!text) return false;
  return text.includes('\n\n') || text.split('\n').length > 3;
}