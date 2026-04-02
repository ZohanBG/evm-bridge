import { IndexerService } from './services/Indexer.service';

async function main() {
  const indexer = new IndexerService();

  process.on('SIGINT', async () => {
    console.log('\n\nReceived SIGINT, shutting down gracefully...');
    await indexer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nReceived SIGTERM, shutting down gracefully...');
    await indexer.stop();
    process.exit(0);
  });

  try {
    await indexer.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();