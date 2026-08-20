import { expect, test } from '@playwright/test'

test.describe('Chaos Simulator dashboard', () => {
  test('renders live telemetry for all three services', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Chaos Simulator' })).toBeVisible()
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible()

    await expect(page.getByTestId('service-card-AuthService')).toBeVisible()
    await expect(page.getByTestId('service-card-PaymentService')).toBeVisible()
    await expect(page.getByTestId('service-card-InventoryService')).toBeVisible()

    await expect(page.getByTestId('event-stream')).toContainText(/System initialized/i)
  })

  test('opens the Scenario Builder with named presets', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('open-scenario-builder').click()
    const builder = page.getByTestId('scenario-builder')
    await expect(builder).toBeVisible()
    await expect(builder.getByText('Chaos Scenario Builder')).toBeVisible()
    await expect(builder.getByText('Rolling Thunder')).toBeVisible()
    await expect(builder.getByText('Black Friday')).toBeVisible()
  })

  test('injecting a 500 error writes a critical event', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('inject-AuthService-500_ERROR').click()
    await expect(page.getByTestId('event-stream')).toContainText(/HTTP 500|marked DOWN/i)
  })

  test('network partition hits the event stream', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('trigger-partition').click()
    await expect(page.getByTestId('event-stream')).toContainText(
      /NETWORK PARTITION|Massive Network Partition/i
    )
  })
})
