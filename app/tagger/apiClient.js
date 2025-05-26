export class TaggerApiClient {
  constructor(baseUrl = 'http://localhost:3067') {
    this.baseUrl = baseUrl;
  }

  async getTaggerDevice() {
    try {
      const response = await fetch(`${this.baseUrl}/device`, {
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

  async autoTagImages(props) {
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

        const response = await fetch(`${this.baseUrl}/tagger`, {
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
