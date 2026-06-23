# ruff: noqa: E501
ALERT_EMAIL_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Currency Threshold Alert</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f6f9;
            color: #333333;
            margin: 0;
            padding: 0;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            border: 1px solid #e1e4e8;
        }}
        .header {{
            background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
            padding: 30px 20px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }}
        .content {{
            padding: 40px 30px;
            line-height: 1.6;
        }}
        .alert-card {{
            background-color: #f8fafc;
            border-left: 4px solid #4f46e5;
            padding: 20px;
            border-radius: 4px;
            margin: 25px 0;
        }}
        .pair-title {{
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-top: 0;
        }}
        .rate-details {{
            font-size: 28px;
            font-weight: 800;
            color: #4f46e5;
            margin: 10px 0;
        }}
        .condition-badge {{
            display: inline-block;
            padding: 4px 12px;
            background-color: #e0f2fe;
            color: #0369a1;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .btn {{
            display: inline-block;
            background-color: #4f46e5;
            color: #ffffff !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            margin-top: 20px;
        }}
        .footer {{
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Currency Threshold Alert</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You are receiving this notification because an exchange rate threshold you subscribed to has been crossed.</p>

            <div class="alert-card">
                <div class="pair-title">{base_currency} &rarr; {target_currency}</div>
                <div class="rate-details">{current_rate:.4f}</div>
                <p>This rate is <span class="condition-badge">{condition}</span> your set threshold of <strong>{threshold:.4f}</strong>.</p>
            </div>

            <p>Keep track of real-time exchange rates, view historic charts, or adjust your settings by visiting your dashboard.</p>

            <div style="text-align: center;">
                <a href="#" class="btn">Go to Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by Currency Tracker Platform.<br>To unsubscribe or manage alerts, please log into your account.</p>
        </div>
    </div>
</body>
</html>
"""

DAILY_SUMMARY_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Exchange Rates Summary</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f6f9;
            color: #333333;
            margin: 0;
            padding: 0;
        }}
        .container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            border: 1px solid #e1e4e8;
        }}
        .header {{
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            padding: 30px 20px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }}
        .content {{
            padding: 40px 30px;
            line-height: 1.6;
        }}
        .summary-date {{
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 20px;
            font-weight: 600;
        }}
        .rate-table {{
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            font-size: 15px;
        }}
        .rate-table th {{
            background-color: #f1f5f9;
            color: #475569;
            font-weight: 600;
            text-align: left;
            padding: 12px 15px;
            border-bottom: 2px solid #e2e8f0;
        }}
        .rate-table td {{
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
        }}
        .rate-table tr:hover {{
            background-color: #f8fafc;
        }}
        .currency-pair {{
            font-weight: 700;
            color: #0f172a;
        }}
        .rate-value {{
            font-family: monospace;
            font-size: 16px;
            font-weight: 600;
            color: #0284c7;
        }}
        .btn {{
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            margin-top: 20px;
        }}
        .footer {{
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Daily Exchange Rates Summary</h1>
        </div>
        <div class="content">
            <div class="summary-date">{date}</div>
            <p>Hello,</p>
            <p>Here is your daily digest of the latest exchange rates for your favorite currency pairs.</p>

            <table class="rate-table">
                <thead>
                    <tr>
                        <th>Currency Pair</th>
                        <th>Latest Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {table_rows}
                </tbody>
            </table>

            <p>Visit the platform to view interactive charts, convert currency, or manage your favorite pairs.</p>

            <div style="text-align: center;">
                <a href="#" class="btn">View Rates Details</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by Currency Tracker Platform.<br>You are receiving this summary because you have active favorite currency pairs.</p>
        </div>
    </div>
</body>
</html>
"""
