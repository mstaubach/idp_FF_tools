interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 flex items-start justify-between">
      <div className="flex items-start gap-2">
        <span className="text-red-500 dark:text-red-400 font-bold">!</span>
        <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm">
          Dismiss
        </button>
      )}
    </div>
  );
}
