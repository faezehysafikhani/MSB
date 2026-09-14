# End-to-end scenario suites

Playwright scripts that drive the running dev server and assert against the
real `localStorage` state the services write. They are the executable form of
the acceptance scenarios agreed for each change request.

```bash
npx vite --port 4179 --host 127.0.0.1     # in one shell
node tests/e2e/<suite>.cjs                # in another
```

| Suite | Covers |
|---|---|
| `resolutionNotification.cjs` | کارتابل ابلاغ، ثبت ابلاغ، رویداد Timeline و سلامت زنجیره سه امضا |
| `notificationLetters.cjs` | شماره نامه ابلاغیه خودکار/یکتا و گزارش ابلاغیه‌ها |
| `followUpCartable.cjs` | مجوزها، زمان‌بندی هفتگی/ماهانه/فصلی/سفارشی و ثبت پیگیری |
| `meetingSignaturesAndDocuments.cjs` | حذف امضای اعضا/مدعوین، امضای تصویری و تولید اسناد رسمی |
| `archive.cjs` | بایگانی شخصی/سازمانی، دسترسی پوشه، بایگانی مصوبه و خروج از بایگانی |

Each script exits non-zero if any assertion fails.
