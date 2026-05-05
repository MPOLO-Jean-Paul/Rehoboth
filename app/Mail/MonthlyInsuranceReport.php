<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MonthlyInsuranceReport extends Mailable
{
    use Queueable, SerializesModels;

    public $insurance;
    public $month;
    public $invoices;

    /**
     * Create a new message instance.
     */
    public function __construct($insurance, $month, $invoices)
    {
        $this->insurance = $insurance;
        $this->month = $month;
        $this->invoices = $invoices;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Rapport Mensuel de Prestations - {$this->month} - Rehoboth (" . $this->insurance->name . ")",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            markdown: 'emails.insurances.report',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
