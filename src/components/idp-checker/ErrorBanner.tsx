interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start justify-between">
      <div className="flex items-start gap-2">
        <span className="text-red-500 font-bold">!</span>
        <p className="text-sm text-red-700">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600 text-sm">
          Dismiss
        </button>
      )}
    </div>
  );
}
