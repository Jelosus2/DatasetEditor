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
          remove_redundant_tags: removeRedundantTags,
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
          if (!results.has(key)) {
            results.set(key, new Set(data[key]));
          } else {
            results.set(key, new Set([...results.get(key), ...data[key]]));
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
