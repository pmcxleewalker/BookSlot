"""
Invoice Generator for TimeSlot Pro
Creates branded PDF invoices for tenant billing
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
import io
import base64

from models import generate_id, TimestampMixin


# Invoice Models
class InvoiceItem(BaseModel):
    description: str
    quantity: int = 1
    unit_price: float
    total: float = 0
    
    def __init__(self, **data):
        super().__init__(**data)
        self.total = self.quantity * self.unit_price


class InvoiceStatus:
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class Invoice(TimestampMixin):
    invoice_id: str = Field(default_factory=lambda: generate_id("inv_"))
    invoice_number: str  # Human readable: INV-2026-001
    tenant_id: str
    
    # Billing details
    bill_to_name: str
    bill_to_email: str
    bill_to_address: Optional[str] = None
    bill_to_city: Optional[str] = None
    bill_to_country: Optional[str] = None
    bill_to_vat: Optional[str] = None  # VAT/Tax ID
    
    # Invoice details
    items: List[Dict[str, Any]] = Field(default_factory=list)
    subtotal: float = 0
    tax_rate: float = 0  # Percentage
    tax_amount: float = 0
    total: float = 0
    currency: str = "EUR"
    
    # Status
    status: str = InvoiceStatus.DRAFT
    issue_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    
    # Notes
    notes: Optional[str] = None
    terms: Optional[str] = "Payment due within 14 days"
    
    # PDF
    pdf_url: Optional[str] = None


async def get_next_invoice_number(db: AsyncIOMotorDatabase, tenant_id: str) -> str:
    """Generate next invoice number for tenant: INV-2026-001"""
    year = datetime.now(timezone.utc).year
    
    # Count existing invoices for this year
    count = await db.invoices.count_documents({
        "tenant_id": tenant_id,
        "invoice_number": {"$regex": f"^INV-{year}-"}
    })
    
    return f"INV-{year}-{str(count + 1).zfill(4)}"


async def create_invoice(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    bill_to_name: str,
    bill_to_email: str,
    items: List[Dict[str, Any]],
    bill_to_address: Optional[str] = None,
    bill_to_city: Optional[str] = None,
    bill_to_country: Optional[str] = None,
    bill_to_vat: Optional[str] = None,
    tax_rate: float = 0,
    notes: Optional[str] = None,
    due_days: int = 14
) -> Dict[str, Any]:
    """Create a new invoice"""
    
    invoice_number = await get_next_invoice_number(db, tenant_id)
    
    # Calculate totals
    subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
    tax_amount = round(subtotal * (tax_rate / 100), 2)
    total = round(subtotal + tax_amount, 2)
    
    # Add totals to items
    for item in items:
        item["total"] = round(item.get("quantity", 1) * item.get("unit_price", 0), 2)
    
    invoice_doc = {
        "invoice_id": generate_id("inv_"),
        "invoice_number": invoice_number,
        "tenant_id": tenant_id,
        "bill_to_name": bill_to_name,
        "bill_to_email": bill_to_email,
        "bill_to_address": bill_to_address,
        "bill_to_city": bill_to_city,
        "bill_to_country": bill_to_country,
        "bill_to_vat": bill_to_vat,
        "items": items,
        "subtotal": subtotal,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total,
        "currency": "EUR",
        "status": InvoiceStatus.DRAFT,
        "issue_date": datetime.now(timezone.utc).isoformat(),
        "due_date": (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat(),
        "paid_date": None,
        "notes": notes,
        "terms": f"Payment due within {due_days} days",
        "pdf_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(invoice_doc)
    
    # Remove _id before returning (MongoDB adds it in place)
    invoice_doc.pop("_id", None)
    
    return invoice_doc


async def get_invoice(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    invoice_id: str
) -> Optional[Dict[str, Any]]:
    """Get invoice by ID"""
    return await db.invoices.find_one(
        {"invoice_id": invoice_id, "tenant_id": tenant_id},
        {"_id": 0}
    )


async def list_invoices(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
) -> List[Dict[str, Any]]:
    """List invoices for a tenant"""
    query = {"tenant_id": tenant_id}
    if status:
        query["status"] = status
    
    invoices = await db.invoices.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return invoices


async def update_invoice_status(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    invoice_id: str,
    status: str
) -> bool:
    """Update invoice status"""
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status == InvoiceStatus.PAID:
        update_data["paid_date"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.invoices.update_one(
        {"invoice_id": invoice_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    return result.modified_count > 0


def generate_invoice_pdf_html(
    invoice: Dict[str, Any],
    tenant: Dict[str, Any]
) -> str:
    """
    Generate HTML for invoice PDF.
    Uses tenant branding for customization.
    """
    branding = tenant.get("branding", {})
    primary_color = branding.get("primary_color", "#2E473B")
    text_color = branding.get("text_color", "#1C1C1C")
    font_family = branding.get("font_family", "Inter, Arial, sans-serif")
    
    # Format dates
    issue_date = datetime.fromisoformat(invoice["issue_date"].replace("Z", "+00:00")).strftime("%d %B %Y")
    due_date = datetime.fromisoformat(invoice["due_date"].replace("Z", "+00:00")).strftime("%d %B %Y") if invoice.get("due_date") else "Upon receipt"
    
    # Generate items rows
    items_html = ""
    for item in invoice.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #E5E5E0;">{item.get('description', '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E5E5E0; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E5E5E0; text-align: right;">{invoice.get('currency', 'EUR')} {item.get('unit_price', 0):.2f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #E5E5E0; text-align: right;">{invoice.get('currency', 'EUR')} {item.get('total', 0):.2f}</td>
        </tr>
        """
    
    # Status badge color
    status_colors = {
        "draft": "#6B7280",
        "sent": "#3B82F6",
        "paid": "#10B981",
        "overdue": "#EF4444",
        "cancelled": "#6B7280"
    }
    status_color = status_colors.get(invoice.get("status", "draft"), "#6B7280")
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice {invoice.get('invoice_number', '')}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: {font_family};
            font-size: 14px;
            line-height: 1.5;
            color: {text_color};
            background: #FFFFFF;
        }}
        
        .invoice-container {{
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
        }}
        
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid {primary_color};
        }}
        
        .company-info h1 {{
            font-size: 24px;
            font-weight: 700;
            color: {primary_color};
            margin-bottom: 8px;
        }}
        
        .company-info p {{
            color: #6B6B6B;
            font-size: 13px;
        }}
        
        .invoice-meta {{
            text-align: right;
        }}
        
        .invoice-number {{
            font-size: 28px;
            font-weight: 700;
            color: {primary_color};
        }}
        
        .invoice-status {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: white;
            background-color: {status_color};
            margin-top: 8px;
        }}
        
        .details-section {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }}
        
        .bill-to, .invoice-details {{
            width: 45%;
        }}
        
        .section-title {{
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #6B6B6B;
            margin-bottom: 8px;
        }}
        
        .bill-to-name {{
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
        }}
        
        .invoice-details table {{
            width: 100%;
        }}
        
        .invoice-details td {{
            padding: 4px 0;
        }}
        
        .invoice-details td:first-child {{
            color: #6B6B6B;
        }}
        
        .invoice-details td:last-child {{
            text-align: right;
            font-weight: 500;
        }}
        
        .items-table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }}
        
        .items-table th {{
            background-color: {primary_color};
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
        }}
        
        .items-table th:nth-child(2),
        .items-table th:nth-child(3),
        .items-table th:nth-child(4) {{
            text-align: right;
        }}
        
        .items-table th:nth-child(2) {{
            text-align: center;
        }}
        
        .totals {{
            width: 300px;
            margin-left: auto;
        }}
        
        .totals table {{
            width: 100%;
        }}
        
        .totals td {{
            padding: 8px 0;
        }}
        
        .totals td:last-child {{
            text-align: right;
            font-weight: 500;
        }}
        
        .totals .total-row {{
            border-top: 2px solid {primary_color};
            font-size: 18px;
            font-weight: 700;
        }}
        
        .totals .total-row td {{
            padding-top: 12px;
            color: {primary_color};
        }}
        
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #E5E5E0;
        }}
        
        .notes {{
            background-color: #F9FAFB;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        
        .notes-title {{
            font-weight: 600;
            margin-bottom: 8px;
        }}
        
        .terms {{
            font-size: 12px;
            color: #6B6B6B;
        }}
        
        .powered-by {{
            text-align: center;
            margin-top: 30px;
            font-size: 11px;
            color: #9CA3AF;
        }}
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="company-info">
                <h1>{tenant.get('name', 'Business Name')}</h1>
                <p>{tenant.get('address', '') or ''}</p>
                <p>{tenant.get('city', '') or ''} {tenant.get('country', '') or ''}</p>
                <p>{tenant.get('email', '')}</p>
                <p>{tenant.get('phone', '') or ''}</p>
            </div>
            <div class="invoice-meta">
                <div class="invoice-number">{invoice.get('invoice_number', '')}</div>
                <div class="invoice-status">{invoice.get('status', 'draft').upper()}</div>
            </div>
        </div>
        
        <div class="details-section">
            <div class="bill-to">
                <div class="section-title">Bill To</div>
                <div class="bill-to-name">{invoice.get('bill_to_name', '')}</div>
                <p>{invoice.get('bill_to_email', '')}</p>
                <p>{invoice.get('bill_to_address', '') or ''}</p>
                <p>{invoice.get('bill_to_city', '') or ''} {invoice.get('bill_to_country', '') or ''}</p>
                {f"<p>VAT: {invoice.get('bill_to_vat')}</p>" if invoice.get('bill_to_vat') else ''}
            </div>
            <div class="invoice-details">
                <table>
                    <tr>
                        <td>Invoice Date</td>
                        <td>{issue_date}</td>
                    </tr>
                    <tr>
                        <td>Due Date</td>
                        <td>{due_date}</td>
                    </tr>
                    <tr>
                        <td>Invoice Number</td>
                        <td>{invoice.get('invoice_number', '')}</td>
                    </tr>
                </table>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>
        
        <div class="totals">
            <table>
                <tr>
                    <td>Subtotal</td>
                    <td>{invoice.get('currency', 'EUR')} {invoice.get('subtotal', 0):.2f}</td>
                </tr>
                {f'''<tr>
                    <td>Tax ({invoice.get('tax_rate', 0)}%)</td>
                    <td>{invoice.get('currency', 'EUR')} {invoice.get('tax_amount', 0):.2f}</td>
                </tr>''' if invoice.get('tax_rate', 0) > 0 else ''}
                <tr class="total-row">
                    <td>Total</td>
                    <td>{invoice.get('currency', 'EUR')} {invoice.get('total', 0):.2f}</td>
                </tr>
            </table>
        </div>
        
        <div class="footer">
            {f'''<div class="notes">
                <div class="notes-title">Notes</div>
                <p>{invoice.get('notes', '')}</p>
            </div>''' if invoice.get('notes') else ''}
            
            <div class="terms">
                <strong>Payment Terms:</strong> {invoice.get('terms', 'Payment due within 14 days')}
            </div>
        </div>
        
        <div class="powered-by">
            Generated by TimeSlot Pro
        </div>
    </div>
</body>
</html>
"""
    
    return html


async def generate_invoice_pdf(
    db: AsyncIOMotorDatabase,
    tenant_id: str,
    invoice_id: str
) -> Optional[bytes]:
    """
    Generate PDF bytes for an invoice.
    Uses weasyprint or similar library.
    Returns base64 encoded PDF or None if failed.
    """
    invoice = await get_invoice(db, tenant_id, invoice_id)
    if not invoice:
        return None
    
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0})
    if not tenant:
        return None
    
    html_content = generate_invoice_pdf_html(invoice, tenant)
    
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        return pdf_bytes
    except ImportError:
        # WeasyPrint not installed, return HTML for now
        # In production, would use a PDF generation service
        return html_content.encode('utf-8')
    except Exception as e:
        print(f"PDF generation error: {e}")
        return None
