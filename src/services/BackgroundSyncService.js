import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import SyncManager from './SyncManager';

const BACKGROUND_SYNC_TASK = 'background-sync-task';
let registrationPromise = null;

const shouldLogBackgroundSync = () => __DEV__ && false;

const logBackgroundSyncInfo = (message, details) => {
  if (shouldLogBackgroundSync()) {
    console.log(message, details || '');
  }
};

const isNativeBackgroundFetchIssue = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('sharedpreferences') ||
    message.includes('nullpointerexception') ||
    message.includes('registertaskasync') ||
    message.includes('backgroundfetch') ||
    message.includes('not available') ||
    message.includes('unavailable')
  );
};

// Define the task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    logBackgroundSyncInfo('[BackgroundFetch] Running background sync...');
    const queueLength = await SyncManager.getQueueLength();
    
    if (queueLength > 0) {
      const result = await SyncManager.processQueue();
      return result ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    logBackgroundSyncInfo('[BackgroundFetch] Task skipped:', error?.message || error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = registerBackgroundSyncOnce().finally(() => {
    registrationPromise = null;
  });

  return registrationPromise;
}

async function registerBackgroundSyncOnce() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
      logBackgroundSyncInfo('[BackgroundFetch] Unavailable on this device/build:', status);
      return false;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      logBackgroundSyncInfo('[BackgroundFetch] Task already registered');
      return true;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 60 * 15, // 15 minutes (minimum allowed by iOS/Android)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    logBackgroundSyncInfo('[BackgroundFetch] Task registered successfully');
    return true;
  } catch (err) {
    if (!isNativeBackgroundFetchIssue(err)) {
      logBackgroundSyncInfo('[BackgroundFetch] Registration skipped:', err?.message || err);
    }
    return false;
  }
}

export async function unregisterBackgroundSync() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }
  } catch (err) {
    logBackgroundSyncInfo('[BackgroundFetch] Unregister skipped:', err?.message || err);
  }
}
