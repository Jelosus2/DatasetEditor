export function removeRedundantTagsHelper(tags, removeUnderscores) {
  const separator = removeUnderscores ? ' ' : '_';
  const tagArray = Array.from(tags);
  const cleaned = [...tagArray];

  for (const tag of [...cleaned]) {
    for (const otherTag of cleaned) {
      if (
        tag !== otherTag &&
        otherTag.includes(tag) &&
        (otherTag.startsWith(tag + separator) ||
          otherTag.endsWith(separator + tag) ||
          otherTag.includes(separator + tag + separator))
      ) {
        const index = cleaned.indexOf(tag);
        if (index !== -1) cleaned.splice(index, 1);
        break;
      }
    }
  }

  return new Set(cleaned);
}

export class TaggerApiClient {
  constructor(host = 'http://localhost') {
    this.host = host;
  }

  async getTaggerDevice(port) {
    try {
      const response = await fetch(`${this.host}:${port}/device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.device;
    } catch (error) {
      console.error('Error getting tagger device:', error);
      return 'Unknown';
    }
  }

  async autoTagImages(props, port) {
    try {
      const {
        images,
        generalThreshold,
        characterThreshold,
        removeUnderscores,
        selectedModels,
        removeRedundantTags,
        tagsIgnored,
      } = props;

      const results = new Map();

      for (const model of selectedModels) {
        const body = {
          images,
          model,
          character_threshold: characterThreshold,
          general_threshold: generalThreshold,
          remove_underscores: removeUnderscores,
          tags_ignored: [...new Set(tagsIgnored)],
        };

        const response = await fetch(`${this.host}:${port}/tagger`, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        for (const key in data) {
          const incoming = new Set(data[key]);
          if (!results.has(key)) {
            const finalSet = removeRedundantTags
              ? removeRedundantTagsHelper(incoming, removeUnderscores)
              : incoming;
            results.set(key, finalSet);
          } else {
            const combined = new Set([...results.get(key), ...incoming]);
            const finalSet = removeRedundantTags
              ? removeRedundantTagsHelper(combined, removeUnderscores)
              : combined;
            results.set(key, finalSet);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error auto tagging images:', error);
      return null;
    }
  }
}
